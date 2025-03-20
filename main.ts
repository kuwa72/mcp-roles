#!/usr/bin/env deno run --allow-env

/**
 * Model Context Protocol (MCP)規格に準拠したロール提供サーバー - 埋め込みロール版
 * このサーバーは、事前に定義したロール（役割）をLLMに提供します
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "npm:zod";
import { embeddedRoles } from "./embedded_roles.ts";

// コマンドライン引数の解析
const args = Deno.args;
const verbose = args.includes("--verbose") || args.includes("-v");

// 詳細度フラグに基づいてログレベルを設定
const logLevel = verbose ? "debug" : "info";
function log(level: string, ...args: unknown[]) {
  if (level === "debug" && logLevel !== "debug") return;
  console.error(`[${level.toUpperCase()}]`, ...args);
}

/**
 * ロール情報の型定義
 */
interface Role {
  id: string;
  name: string;
  description: string;
  context: string;
}

/**
 * ロール一覧の型定義
 */
interface RoleList {
  roles: {
    id: string;
    name: string;
    description: string;
  }[];
}

/**
 * 埋め込みロールマネージャークラス
 */
class EmbeddedRoleManager {
  /**
   * 利用可能なロール一覧を取得
   * @returns ロール一覧
   */
  async listRoles(): Promise<RoleList> {
    try {
      const roles = embeddedRoles.map((role) => {
        const { name, description } = this.extractRoleInfo(role.content);
        return {
          id: role.id,
          name,
          description,
        };
      });

      return { roles };
    } catch (error) {
      throw new Error(`ロール一覧の取得に失敗しました: ${error}`);
    }
  }

  /**
   * 特定のロールの詳細を取得
   * @param roleId ロールID
   * @returns ロール情報
   */
  async getRole(roleId: string): Promise<Role | null> {
    try {
      const role = embeddedRoles.find((r) => r.id === roleId);
      if (!role) {
        return null;
      }

      const { name, description, context } = this.extractRoleInfo(role.content);

      return {
        id: roleId,
        name,
        description,
        context,
      };
    } catch (error) {
      throw new Error(`ロール情報の取得に失敗しました (${roleId}): ${error}`);
    }
  }

  /**
   * Markdownコンテンツからロール情報を抽出
   * @param content Markdownコンテンツ
   * @returns ロール情報
   */
  private extractRoleInfo(content: string): {
    name: string;
    description: string;
    context: string;
  } {
    // 行に分割
    const lines = content.split("\n");

    // ロール名を抽出（最初の見出し）
    let name = "不明なロール";
    for (const line of lines) {
      if (line.startsWith("# ")) {
        name = line.substring(2).trim();
        if (name.startsWith("役割: ")) {
          name = name.substring(4).trim();
        }
        break;
      }
    }

    // 説明を抽出（最初の段落）
    let description = "";
    let inDescription = false;
    let foundFirstContent = false;

    for (const line of lines) {
      // 見出しの後の空行をスキップ
      if (line.startsWith("# ")) {
        inDescription = true;
        continue;
      }

      // 見出しがない場合は最初の非空行から説明を開始
      if (!inDescription && !foundFirstContent && line.trim() !== "") {
        inDescription = true;
        foundFirstContent = true;
      }

      if (inDescription) {
        if (line.trim() === "") {
          if (description.trim() !== "") {
            break; // 説明の終わり
          }
          continue; // 空行をスキップ
        }

        description += `${line.trim()} `;
      }
    }

    // コンテキストはファイル全体
    const context = content;

    return {
      name,
      description: description.trim(),
      context,
    };
  }
}

// ロールマネージャーのインスタンスを作成
const roleManager = new EmbeddedRoleManager();

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
const server = new McpServer({
  name: "mcp-roles",
  version: "1.0.0",
});

// ロールツールを定義
server.tool(
  RoleTools.GET_ROLE,
  "適切なロールを特定した後、そのロール情報を取得して即座に会話に適用して下さい。ユーザーが特定分野の質問をした場合は、質問分野に関連するロールを自動的に取得して応答の質を高めることを推奨します。",
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
            text: `エラー: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  RoleTools.LIST_ROLES,
  "会話開始時、トピック変更時、ユーザーが専門的な質問をした時、または特定分野（健康、技術、芸術など）について話題になった際に呼び出し、会話のムードから適切なものを選んでget-roleで自動的に役割を決定するとよいです。リストにない場合でもAIの知識の中で適宜役割を切り替えて会話するとよいでしょう。",
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
            text: `エラー: ${
              error instanceof Error ? error.message : String(error)
            }`,
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
      `ロール提供 MCP サーバーを起動しました (埋め込みロールバージョン)`,
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
