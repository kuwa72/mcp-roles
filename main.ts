#!/usr/bin/env -S deno run --allow-env --allow-read

import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ErrorCode,
	McpError,
} from "npm:@modelcontextprotocol/sdk/types.js";
import * as path from "@std/path"
import * as roles from "./embedded_roles.ts";
import * as fs from "@std/fs";

const homedir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "~";
const configDir = path.join(homedir, ".mcp-roles");

async function listRoles(): Promise<roles.Role[]> {
  const ret = [...roles.roles];
  // configDirがなければ作る
  if (!fs.existsSync(configDir)) {
    await Deno.mkdir(configDir);
  }
  // 埋め込みロールを読み込んだロールで上書きして返す
  const entries = await Deno.readDir(configDir);
  for await (const entry of entries) {
    if (entry.isFile) {
      // 拡張子なしのファイル名をロールIDとみなす
      const name = path.basename(entry.name, path.extname(entry.name));
      // 1行目だけをロール内容とみなす
      const content = await Deno.readTextFile(path.join(configDir, entry.name));
      const description = content.split('\n')[0];
      ret.push({ id: name, content: description });
    }
  }
  return ret;
}

async function getRole(id: string): Promise<roles.Role | undefined> {
  const roles = await listRoles();
  if (roles.find(role => role.id === id)) {
    // ファイルがあるか確認する
    try {
      const content = await Deno.readTextFile(path.join(configDir, `${id}.md`));
      return { id, content };
    } catch {
      // ファイルがない場合は埋め込みロールを返す
      return roles.find(role => role.id === id);
    }
  }
  return undefined;
}

class RoleServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{
				name: "role-server",
				version: "0.2.0",
			},
			{
				capabilities: {
					tools: {},
				},
			},
		);

		this.setupToolHandlers();

		this.server.onerror = (error) => console.error("[MCP Error]", error);
	}

	private setupToolHandlers() {
		// ツール一覧を提供
		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: "list-roles",
					description: "ロール一覧を取得します",
					inputSchema: {
						type: "object",
						properties: {},
						required: [],
					},
				},
				{
					name: "get-role",
					description: "ロールの内容を取得します",
					inputSchema: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "ロールID",
							},
						},
						required: ["id"],
					},
				},
			],
		}));

		// ツールの実装
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			try {
				switch (request.params.name) {
          case "list-roles": {
            const roles = await listRoles();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(roles, null, 2),
                },
              ],
            };
          }
					case "get-role": {
						const { id } = request.params.arguments as { id: string };
						const role = await getRole(id);
						if (!role) {
							throw new McpError(
								ErrorCode.InternalError,
								`ロール ${id} が見つかりません`,
							);
						}
						return {
							content: [
								{
									type: "text",
									text: role.content,
								},
							],
						};
					}

					default:
						throw new McpError(
							ErrorCode.MethodNotFound,
							`不明なツール: ${request.params.name}`,
						);
				}
			} catch (error) {
				if (error instanceof McpError) {
					throw error;
				}
				throw new McpError(
					ErrorCode.InternalError,
					`エラー: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		});
	}

	async run() {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error("Echo MCP server running on stdio");
	}
}

// サーバーの起動
const server = new RoleServer();
server.run().catch(console.error);
