/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  // Small test route
	  if (request.method === "GET" && url.pathname === "/") {
		return Response.json({
		  ok: true,
		  message: "Worker is running"
		});
	  }
  
	  // Create a session
	  if (request.method === "POST" && url.pathname === "/api/sessions") {
		try {
		  const secret = request.headers.get("x-ingest-secret");
  
		  if (secret !== env.INGEST_SECRET) {
			return Response.json(
			  { ok: false, error: "Unauthorized" },
			  { status: 401 }
			);
		  }
  
		  const body = await request.json();
		  const { name, description } = body;
  
		  if (!name) {
			return Response.json(
			  { ok: false, error: "name is required" },
			  { status: 400 }
			);
		  }
  
		  const result = await env.DB
			.prepare(
			  `INSERT INTO sessions (name, description)
			   VALUES (?, ?)`
			)
			.bind(name, description ?? null)
			.run();
  
		  return Response.json({
			ok: true,
			message: "Session inserted",
			session_id: result.meta?.last_row_id ?? null,
			result
		  });
		} catch (error) {
		  return Response.json(
			{
			  ok: false,
			  error: "Invalid request",
			  details: String(error)
			},
			{ status: 500 }
		  );
		}
	  }
  
	  // List all sessions (oldest first)
	  if (request.method === "GET" && url.pathname === "/api/sessions") {
		try {
		  const { results } = await env.DB
			.prepare("SELECT id, name, description FROM sessions ORDER BY id ASC")
			.all();
		  return Response.json({ ok: true, sessions: results });
		} catch (error) {
		  return Response.json({ ok: false, error: "Database error", details: String(error) }, { status: 500 });
		}
	  }

	  // Get paginated messages for a session
	  const msgRoute = url.pathname.match(/^\/api\/sessions\/(\d+)\/messages$/);
	  if (request.method === "GET" && msgRoute) {
		try {
		  const sessionId = parseInt(msgRoute[1], 10);
		  const limit = 10;
		  const order = url.searchParams.get("order") === "desc" ? "DESC" : "ASC";

		  const { results: countRows } = await env.DB
			.prepare("SELECT COUNT(*) as total FROM messages WHERE session_id = ?")
			.bind(sessionId)
			.all();

		  const total = countRows[0]?.total ?? 0;
		  const totalPages = Math.max(1, Math.ceil(total / limit));

		  const pageParam = url.searchParams.get("page") || "1";
		  const page = pageParam === "last"
			? totalPages
			: Math.max(1, Math.min(parseInt(pageParam, 10) || 1, totalPages));

		  const offset = (page - 1) * limit;

		  const { results: messages } = await env.DB
			.prepare(`SELECT id, text, timestamp FROM messages WHERE session_id = ? ORDER BY id ${order} LIMIT ? OFFSET ?`)
			.bind(sessionId, limit, offset)
			.all();

		  return Response.json({ ok: true, messages, total, page, totalPages });
		} catch (error) {
		  return Response.json({ ok: false, error: "Database error", details: String(error) }, { status: 500 });
		}
	  }

	  // Insert a message
	  if (request.method === "POST" && url.pathname === "/api/messages") {
		try {
		  const secret = request.headers.get("x-ingest-secret");
  
		  if (secret !== env.INGEST_SECRET) {
			return Response.json(
			  { ok: false, error: "Unauthorized" },
			  { status: 401 }
			);
		  }
  
		  const body = await request.json();
		  const { session_id, text } = body;
  
		  if (!session_id || !text) {
			return Response.json(
			  { ok: false, error: "session_id and text are required" },
			  { status: 400 }
			);
		  }
  
		  const timestamp = new Date().toISOString();
  
		  const result = await env.DB
			.prepare(
			  `INSERT INTO messages (session_id, text, timestamp)
			   VALUES (?, ?, ?)`
			)
			.bind(session_id, text, timestamp)
			.run();
  
		  return Response.json({
			ok: true,
			message: "Message inserted",
			result
		  });
		} catch (error) {
		  return Response.json(
			{
			  ok: false,
			  error: "Invalid request",
			  details: String(error)
			},
			{ status: 500 }
		  );
		}
	  }
  
	  return Response.json(
		{ ok: false, error: "Not found" },
		{ status: 404 }
	  );
	}
  };