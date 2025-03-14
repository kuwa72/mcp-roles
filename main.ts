#!/usr/bin/env deno run --allow-read --allow-env

/**
 * Model Context Protocol (MCP)規格に準拠したロール提供サーバー
 * このサーバーは、事前に定義したロール（役割）をLLMに提供します
 */

import { MCPServer, Request } from "./deps.ts";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "npm:zod";
import { join, basename } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

// ロールマネージャーのインポート
import { RoleManager } from "./role_manager.ts";

// コマンドライン引数の解析
const args = Deno.args;
const verbose = args.includes("--verbose") || args.includes("-v");

// 詳細度フラグに基づいてログレベルを設定
const logLevel = verbose ? "debug" : "info";
function log(level: string, ...args: unknown[]) {
	if (level === "debug" && logLevel !== "debug") return;
	console.error(`[${level.toUpperCase()}]`, ...args);
}

// ホームディレクトリのパスを取得
const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
if (!homeDir) {
	log("error", "ホームディレクトリが見つかりません");
	Deno.exit(1);
}

// デフォルトのロールディレクトリパス
const defaultRolesDir = "./roles";
// ユーザー設定のロールディレクトリパス
const userRolesDir = join(homeDir, ".config", "mcp-roles", "roles");

// ロールマネージャーのインスタンスを作成
// ユーザー設定のディレクトリが存在する場合はそれを使用し、
// 存在しない場合はデフォルトのディレクトリを使用
let rolesDir = defaultRolesDir;
if (await exists(userRolesDir)) {
	rolesDir = userRolesDir;
	log("info", `ユーザー設定のロールディレクトリを使用します: ${userRolesDir}`);
} else {
	log("info", `デフォルトのロールディレクトリを使用します: ${defaultRolesDir}`);
}

const roleManager = new RoleManager(rolesDir);

// ツール入力用のZodスキーマを定義
const GetRoleSchema = z.object({
	roleId: z.string().describe("ロールID（ファイル名から拡張子を除いたもの）"),
});

const ListRolesSchema = z.object({});

// ロールツールをenumオブジェクトとして定義
const RoleTools = {
	GET_ROLE: "get-role",
	LIST_ROLES: "list-roles",
} as const;

// MCPサーバーを初期化
const server = new MCPServer({
	name: "mcp-roles",
	version: "1.0.0",
});

// ロールツールを定義
server.tool(
	RoleTools.GET_ROLE,
	"特定のロール詳細を取得します。ロールIDを指定すると、そのロールの名前、説明、コンテキストを返します。",
	GetRoleSchema.shape,
	async (args: z.infer<typeof GetRoleSchema>) => {
		try {
			const role = await roleManager.getRole(args.roleId);
			if (!role) {
				return {
					content: [
						{
							type: "text",
							text: `エラー: ロールID '${args.roleId}' が見つかりません`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(role, null, 2),
					},
				],
				isError: false,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `エラー: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

server.tool(
	RoleTools.LIST_ROLES,
	"利用可能なロール一覧を取得します。各ロールのID、名前、簡単な説明を含みます。",
	ListRolesSchema.shape,
	async () => {
		try {
			const roles = await roleManager.listRoles();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(roles, null, 2),
					},
				],
				isError: false,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `エラー: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// サーバーを起動
async function main() {
	try {
		const transport = new StdioServerTransport();
		await server.connect(transport);
		log(
			"info",
			`ロール提供 MCP サーバーを起動しました (ロールディレクトリ: ${roleManager.rolesDir})`,
		);

		// 利用可能なロールを表示
		const roles = await roleManager.listRoles();
		log("info", `利用可能なロール: ${roles.roles.length}個`);
		if (verbose) {
			for (const role of roles.roles) {
				log("debug", `- ${role.id}: ${role.name} - ${role.description}`);
			}
		}
	} catch (error) {
		log("error", `サーバーエラー: ${error}`);
		Deno.exit(1);
	}
}

main().catch((error) => {
	console.error("致命的エラー:", error);
	Deno.exit(1);
});
