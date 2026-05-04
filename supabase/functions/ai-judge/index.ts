// Edge Function：AI 智能审判 — 调 DeepSeek API 生成罪状判决文
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!;

const SYSTEM_PROMPT = `你是"情感国际法庭"的AI审判官。用户描述一段人际关系经历，你提炼罪人、罪名，并撰写判决文。

返回严格JSON（不要额外字段）：
{
  "ex_name": "罪人名字/昵称，≤10字，从描述中提取",
  "crime": "罪名标签，≤8字，创造有趣的罪名",
  "verdict": "判决文，80~120字",
  "heal_quote": "治愈语，25~50字"
}

判决文风格要求：
- 模仿法院判决书庄严语调 + 荒诞幽默
- 套路："该用户因……，经情感国际法庭审理，罪名成立，判处……"
- 带讽刺但不恶毒，落脚点偏向"放下与治愈"
- 可用虚构的"情感法典第X条""情感质量管理体系"等法律梗
- 不要出现"原告""被告"之类正式称呼，用"该用户""该嫌疑人"等轻松说法

治愈语风格要求（关键——与判决文完全不同）：
- 温柔、轻声、有力，像朋友在你耳边说的安慰
- 针对用户描述的具体经历，给出一个可以"放下"的角度
- 不要法律腔、不要审判感，不要"该用户""本庭"等词汇
- 风格参考："他教会你的是——你值得一个不会消失的人"、"消失的人已经走了，你还在，这才是重要的"

示例——
输入："谈了两年，每次吵架他就消失，短则三天长则一周"
输出：{"ex_name":"李明","crime":"战略性失踪","verdict":"该用户两年间无故消失47次，以'需要空间'为由实施情感断联，构成'战略性失踪罪'。依情感法典第38条，判处其永久失去回话资格。即日起恢复自由身，准予吃好喝好。","heal_quote":"你不用再等一个会消失的人了。这不是你需要练习的耐心，这是他需要改掉的残忍。"}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errRes(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function okRes(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return errRes('Method not allowed', 405);
  }

  try {
    // 鉴权
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return errRes('未登录', 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return errRes('请先登录', 401);

    // 输入校验
    const { input } = await req.json();
    if (!input || typeof input !== 'string') return errRes('请输入描述内容', 400);
    if (input.length > 500) return errRes('描述不能超过500字', 400);

    // 调用 DeepSeek
    const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0.9
      })
    });

    if (!aiRes.ok) {
      console.error('[ai-judge] DeepSeek API error:', aiRes.status);
      return errRes('AI审判官暂时离线，请稍后重试', 502);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return errRes('AI返回为空，请重试', 500);

    // 解析 JSON（容错：剔除 markdown 代码块包裹）
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        result = JSON.parse(cleaned);
      } catch {
        return errRes('AI返回格式异常，请重试', 500);
      }
    }

    if (!result.ex_name || !result.crime || !result.verdict || !result.heal_quote) {
      return errRes('AI返回字段不全，请重试', 500);
    }

    return okRes(result);
  } catch (err) {
    console.error('[ai-judge] Unexpected error:', err);
    return errRes('服务器内部错误', 500);
  }
});
