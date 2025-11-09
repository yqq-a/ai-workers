import OpenAI from 'openai';

// 定义环境变量类型
interface Env {
	DEEPSEEK_API_KEY: string;
	ENVIRONMENT: string;
}

// CORS处理函数（保持不变）
function handleCors(request: Request) {
	const origin = request.headers.get('Origin');
	const allowedOrigins = ['http://localhost:3000', 'https://yqcly1.shop'];
	const allowedOrigin = allowedOrigins.includes(origin || '') ? origin : '*';

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': allowedOrigin,
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Access-Control-Max-Age': '86400',
			},
		});
	}
	return { allowedOrigin };
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsResult = handleCors(request);

		if (corsResult instanceof Response) return corsResult;

		try {
			if (request.method === 'GET') {
				// 从URL参数获取消息
				const url = new URL(request.url);
				const message = url.searchParams.get('message');

				if (!message) {
					return new Response(JSON.stringify({ error: 'Missing message parameter' }), {
						status: 400,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': corsResult.allowedOrigin,
						},
					});
				}

				const openai = new OpenAI({
					baseURL: 'https://api.deepseek.com',
					apiKey: env.DEEPSEEK_API_KEY,
					dangerouslyAllowBrowser: true,
				});

				const completion = await openai.chat.completions.create({
					messages: [{ role: 'user', content: message }],
					model: 'deepseek-chat',
				});

				const content = completion.choices[0].message.content;

				return new Response(JSON.stringify({ content }), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': corsResult.allowedOrigin,
					},
				});
			}
		} catch (error) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': corsResult.allowedOrigin,
				},
			});
		}
	},
} satisfies ExportedHandler<Env>;
