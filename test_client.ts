/**
 * MCPロール提供サーバーのテストクライアント
 * このスクリプトは、MCPサーバーに接続して、list-rolesとget-roleコマンドをテストします。
 */

import { z } from "npm:zod";

// コマンドライン引数の解析
const args = Deno.args;
const roleId = args[0]; // 特定のロールIDを指定する場合

// MCPサーバープロセスを起動
async function startMcpServer(): Promise<Deno.ChildProcess> {
	console.log("MCPサーバーを起動しています...");

	const command = new Deno.Command("deno", {
		args: ["run", "--allow-read", "--allow-env", "main.ts", "--verbose"],
		stdout: "piped",
		stderr: "piped",
		stdin: "piped",
	});

	const process = command.spawn();

	// サーバーが起動するまで少し待機
	await new Promise((resolve) => setTimeout(resolve, 1000));

	return process;
}

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

// リクエストを送信して応答を受け取る
async function sendRequest(
	process: Deno.ChildProcess,
	request: JsonRpcRequest,
): Promise<string | null> {
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
			return decoder.decode(value);
		}
		return null;
	} catch (error) {
		console.error(`リクエスト送信中にエラーが発生しました: ${error}`);
		return null;
	}
}

// list-rolesコマンドをテスト
async function testListRoles(process: Deno.ChildProcess) {
	console.log("\n=== list-roles コマンドのテスト ===");

	const request = {
		jsonrpc: "2.0",
		id: "1",
		method: "call",
		params: {
			tool: "list-roles",
			args: {},
		},
	};

	const responseText = await sendRequest(process, request);
	if (responseText) {
		try {
			const response = JSON.parse(responseText);
			console.log("利用可能なロール:");

			if (response.result?.content?.[0]) {
				const roles = JSON.parse(response.result.content[0].text);
				for (const role of roles.roles) {
					console.log(`- ${role.id}: ${role.name} - ${role.description}`);
				}
			} else {
				console.error("予期しないレスポンス形式:", response);
			}
		} catch (error) {
			console.error("レスポンスの解析に失敗しました:", error);
			console.error("受信したデータ:", responseText);
		}
	}
}

// get-roleコマンドをテスト
async function testGetRole(process: Deno.ChildProcess, roleId: string) {
	console.log(`\n=== get-role コマンドのテスト (roleId: ${roleId}) ===`);

	const request = {
		jsonrpc: "2.0",
		id: "2",
		method: "call",
		params: {
			tool: "get-role",
			args: {
				roleId: roleId,
			},
		},
	};

	const responseText = await sendRequest(process, request);
	if (responseText) {
		try {
			const response = JSON.parse(responseText);

			if (response.result?.content?.[0]) {
				if (!response.result.isError) {
					const role = JSON.parse(response.result.content[0].text);
					console.log(`ロール情報 (${role.id}):`);
					console.log(`- 名前: ${role.name}`);
					console.log(`- 説明: ${role.description}`);
					console.log("- コンテキスト:");
					console.log("```");
					console.log(role.context);
					console.log("```");
				} else {
					console.error("エラー:", response.result.content[0].text);
				}
			} else {
				console.error("予期しないレスポンス形式:", response);
			}
		} catch (error) {
			console.error("レスポンスの解析に失敗しました:", error);
			console.error("受信したデータ:", responseText);
		}
	}
}

// メイン関数
async function main() {
	let process: Deno.ChildProcess | null = null;

	try {
		// MCPサーバーを起動
		process = await startMcpServer();

		// list-rolesコマンドをテスト
		await testListRoles(process);

		// get-roleコマンドをテスト（引数で指定されたロールIDまたはデフォルトで"engineer"）
		if (roleId) {
			await testGetRole(process, roleId);
		} else {
			await testGetRole(process, "engineer");
		}

		console.log("\nテストが完了しました。");
	} catch (error) {
		console.error("テスト中にエラーが発生しました:", error);
	} finally {
		// プロセスをクリーンアップ
		if (process) {
			try {
				process.kill();
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
}

// スクリプトを実行
main();
