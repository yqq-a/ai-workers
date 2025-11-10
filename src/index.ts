import OpenAI from 'openai';

// 定义环境变量类型
interface Env {
	DEEPSEEK_API_KEY: string;
	ENVIRONMENT: string;
}

// CORS处理函数
function handleCors(request: Request) {
	const origin = request.headers.get('Origin');
	const allowedOrigins = ['http://localhost:3000', 'https://yqcly1.shop', 'http://localhost:5173', 'http://localhost:8787'];
	const allowedOrigin = allowedOrigins.includes(origin || '') ? origin : '*';

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': allowedOrigin,
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
		const apiKey = env.DEEPSEEK_API_KEY;
		try {
			// 初始化 OpenAI 客户端
			const openai = new OpenAI({
				baseURL: 'https://api.deepseek.com',
				apiKey: apiKey,
				dangerouslyAllowBrowser: true,
			});

			if (request.method === 'POST') {
				const body = await request.json();
				const { messages, stream = true, model = 'deepseek-chat' } = body;

				if (!messages || !Array.isArray(messages)) {
					return new Response(JSON.stringify({ error: 'Missing or invalid messages array' }), {
						status: 400,
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': corsResult.allowedOrigin,
						},
					});
				}

				// 流式响应 - 参考 Node.js 代理的实现
				if (stream) {
					const completion = await openai.chat.completions.create({
						messages: messages,
						model: model,
						stream: true,
						temperature: 0.7,
						max_tokens: 2048,
					});

					// 创建 TransformStream 来直接传递流数据
					const { readable, writable } = new TransformStream();
					const writer = writable.getWriter();

					// 在后台处理流
					ctx.waitUntil(
						(async () => {
							try {
								for await (const chunk of completion) {
									// 直接传递原始 chunk 数据，不重新包装
									const chunkData = `data: ${JSON.stringify(chunk)}\n\n`;
									await writer.write(new TextEncoder().encode(chunkData));
								}
								// 发送结束标记
								await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
								await writer.close();
							} catch (error) {
								console.error('Stream error:', error);
								const errorData = { error: error.message };
								await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(errorData)}\n\n`));
								await writer.close();
							}
						})()
					);

					return new Response(readable, {
						headers: {
							'Content-Type': 'text/event-stream; charset=utf-8',
							'Access-Control-Allow-Origin': corsResult.allowedOrigin,
							'Cache-Control': 'no-cache',
							Connection: 'keep-alive',
							'Transfer-Encoding': 'chunked',
						},
					});
				}

				// 非流式 POST 响应
				const completion = await openai.chat.completions.create({
					messages: messages,
					model: model,
					stream: false,
				});

				const content = completion.choices[0].message.content;

				return new Response(JSON.stringify({ content }), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': corsResult.allowedOrigin,
					},
				});
			}

			// 不支持的请求方法
			return new Response(JSON.stringify({ error: 'Method not allowed' }), {
				status: 405,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': corsResult.allowedOrigin,
				},
			});
		} catch (error) {
			console.error('Global error:', error);
			return new Response(
				JSON.stringify({
					error: error.message || 'Internal server error',
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': corsResult.allowedOrigin,
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;
