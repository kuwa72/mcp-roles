/**
 * MCPロール提供サーバーの統合テスト
 * このスクリプトは、MCPサーバーを起動し、実際のJSONRPC通信を行ってテストします。
 */

import {
	assertEquals,
	assertExists,
} from "https://deno.land/std/testing/asserts.ts";

// JSONRPCリクエストの型定義
interface JsonRpcRequest {
	jsonrpc: string;
	id: string;
	method: string;
	params: {
		tool: string;
		args: Record<string, unknown>;
	};
}

// JSONRPCレスポンスの型定義
interface JsonRpcResponse {
	jsonrpc: string;
	id: string;
	result?: {
		content: Array<{
			type: string;
			text: string;
		}>;
		isError: boolean;
	};
	error?: {
		code: number;
		message: string;
	};
}

// MCPサーバープロセスを起動
async function startMcpServer(): Promise<Deno.ChildProcess> {
	const command = new Deno.Command("deno", {
		args: ["run", "--allow-read", "--allow-env", "main.ts"],
		stdout: "piped",
		stderr: "piped",
		stdin: "piped",
	});

	const process = command.spawn();

	// サーバーが起動するまで少し待機
	await new Promise((resolve) => setTimeout(resolve, 1000));

	return process;
}

// リクエストを送信して応答を受け取る
async function sendRequest(
	process: Deno.ChildProcess,
	request: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
	try {
		// リクエストを送信
		const encoder = new TextEncoder();
		const requestData = encoder.encode(`${JSON.stringify(request)}\n`);

		const writer = process.stdin.getWriter();
		await writer.write(requestData);
		await writer.releaseLock();

		// レスポンスを読み取り
		const reader = process.stdout.getReader();
		const { value } = await reader.read();
		reader.releaseLock();

		if (value) {
			const decoder = new TextDecoder();
			const responseText = decoder.decode(value);
			return JSON.parse(responseText) as JsonRpcResponse;
		}
		return null;
	} catch (error) {
		console.error(`リクエスト送信中にエラーが発生しました: ${error}`);
		return null;
	}
}

// list-rolesコマンドのテスト
Deno.test("Integration - list-roles", async () => {
	let process: Deno.ChildProcess | null = null;

	try {
		// MCPサーバーを起動
		process = await startMcpServer();

		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: "test-list-roles",
			method: "call",
			params: {
				tool: "list-roles",
				args: {},
			},
		};

		const response = await sendRequest(process, request);
		assertExists(response, "レスポンスが返されるべき");

		if (!response || !response.result) {
			throw new Error("レスポンスまたは結果が存在しません");
		}

		assertEquals(response.result.isError, false, "エラーが発生していないべき");

		const content = response.result.content[0];
		assertEquals(content.type, "text", "コンテンツタイプはtextであるべき");

		const roles = JSON.parse(content.text);
		assertExists(roles.roles, "ロール一覧が含まれるべき");
		assertEquals(Array.isArray(roles.roles), true, "ロールは配列であるべき");

		// 少なくとも1つのロールが存在することを確認
		assertEquals(
			roles.roles.length > 0,
			true,
			"少なくとも1つのロールが存在するべき",
		);

		// 各ロールが必要なプロパティを持っていることを確認
		for (const role of roles.roles) {
			assertExists(role.id, "ロールはIDを持つべき");
			assertExists(role.name, "ロールは名前を持つべき");
			assertExists(role.description, "ロールは説明を持つべき");
		}
	} finally {
		// プロセスをクリーンアップ
		if (process) {
			try {
				process.kill("SIGTERM");
			} catch (error) {
				// プロセスが既に終了している場合は無視
				if (
					!(
						error instanceof TypeError &&
						error.message.includes("already terminated")
					)
				) {
					console.error("プロセスの終了に失敗しました:", error);
				}
			}
		}
	}
});

// get-role コマンドのテスト（存在するロール）
Deno.test("Integration - get-role (existing)", async () => {
	let process: Deno.ChildProcess | null = null;

	try {
		// MCPサーバーを起動
		process = await startMcpServer();

		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: "test-get-role",
			method: "call",
			params: {
				tool: "get-role",
				args: {
					roleId: "engineer",
				},
			},
		};

		const response = await sendRequest(process, request);
		assertExists(response, "レスポンスが返されるべき");

		if (!response || !response.result) {
			throw new Error("レスポンスまたは結果が存在しません");
		}

		assertEquals(response.result.isError, false, "エラーが発生していないべき");

		const content = response.result.content[0];
		assertEquals(content.type, "text", "コンテンツタイプはtextであるべき");

		const role = JSON.parse(content.text);
		assertEquals(role.id, "engineer", "正しいIDが返されるべき");
		assertExists(role.name, "ロールは名前を持つべき");
		assertExists(role.description, "ロールは説明を持つべき");
		assertExists(role.context, "ロールはコンテキストを持つべき");
	} finally {
		// プロセスをクリーンアップ
		if (process) {
			try {
				process.kill("SIGTERM");
			} catch (error) {
				// プロセスが既に終了している場合は無視
				if (
					!(
						error instanceof TypeError &&
						error.message.includes("already terminated")
					)
				) {
					console.error("プロセスの終了に失敗しました:", error);
				}
			}
		}
	}
});

// get-role コマンドのテスト（存在しないロール）
Deno.test("Integration - get-role (non-existent)", async () => {
	let process: Deno.ChildProcess | null = null;

	try {
		// MCPサーバーを起動
		process = await startMcpServer();

		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: "test-get-nonexistent-role",
			method: "call",
			params: {
				tool: "get-role",
				args: {
					roleId: "non_existent_role",
				},
			},
		};

		const response = await sendRequest(process, request);
		assertExists(response, "レスポンスが返されるべき");

		if (!response || !response.result) {
			throw new Error("レスポンスまたは結果が存在しません");
		}

		assertEquals(response.result.isError, true, "エラーが発生するべき");

		const content = response.result.content[0];
		assertEquals(content.type, "text", "コンテンツタイプはtextであるべき");
		assertEquals(
			content.text.includes("見つかりません"),
			true,
			"エラーメッセージには「見つかりません」が含まれるべき",
		);
	} finally {
		// プロセスをクリーンアップ
		if (process) {
			try {
				process.kill("SIGTERM");
			} catch (error) {
				// プロセスが既に終了している場合は無視
				if (
					!(
						error instanceof TypeError &&
						error.message.includes("already terminated")
					)
				) {
					console.error("プロセスの終了に失敗しました:", error);
				}
			}
		}
	}
});

// 無効なツール名のテスト
Deno.test("Integration - invalid tool name", async () => {
	let process: Deno.ChildProcess | null = null;

	try {
		// MCPサーバーを起動
		process = await startMcpServer();

		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id: "test-invalid-tool",
			method: "call",
			params: {
				tool: "invalid-tool",
				args: {},
			},
		};

		const response = await sendRequest(process, request);
		assertExists(response, "レスポンスが返されるべき");

		if (!response || !response.error) {
			throw new Error("レスポンスまたはエラーが存在しません");
		}

		assertEquals(
			response.error.code,
			-32601,
			"メソッドが見つからないエラーコードであるべき",
		);
	} finally {
		// プロセスをクリーンアップ
		if (process) {
			try {
				process.kill("SIGTERM");
			} catch (error) {
				// プロセスが既に終了している場合は無視
				if (
					!(
						error instanceof TypeError &&
						error.message.includes("already terminated")
					)
				) {
					console.error("プロセスの終了に失敗しました:", error);
				}
			}
		}
	}
});
