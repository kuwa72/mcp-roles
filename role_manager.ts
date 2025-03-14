/**
 * ロールの検索と読み込みを行うモジュール
 */

import { join, basename } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

/**
 * ロール情報の型定義
 */
export interface Role {
	id: string;
	name: string;
	description: string;
	context: string;
}

/**
 * ロール一覧の型定義
 */
export interface RoleList {
	roles: {
		id: string;
		name: string;
		description: string;
	}[];
}

/**
 * ロールマネージャークラス
 */
export class RoleManager {
	rolesDir: string;

	/**
	 * コンストラクタ
	 * @param rolesDir ロールファイルが格納されているディレクトリのパス
	 */
	constructor(rolesDir: string) {
		this.rolesDir = rolesDir;
	}

	/**
	 * 利用可能なロール一覧を取得
	 * @returns ロール一覧
	 */
	async listRoles(): Promise<RoleList> {
		const roles: RoleList["roles"] = [];

		try {
			// ディレクトリが存在するか確認
			if (!(await exists(this.rolesDir))) {
				// show roleDir for debug
				console.error(`rolesDir: ${this.rolesDir}`);
				// show pwd for debug
				console.error(`pwd: ${Deno.cwd()}`);
				throw new Error(`ロールディレクトリが存在しません: ${this.rolesDir}`);
			}

			// ディレクトリ内のMarkdownファイルを取得
			for await (const entry of Deno.readDir(this.rolesDir)) {
				if (entry.isFile && entry.name.endsWith(".md")) {
					try {
						// ファイルからロール情報を抽出
						const roleId = entry.name.replace(/\.md$/, "");
						const filePath = join(this.rolesDir, entry.name);
						const content = await Deno.readTextFile(filePath);

						// ロール名と説明を抽出
						const { name, description } = this.extractRoleInfo(content);

						roles.push({
							id: roleId,
							name,
							description,
						});
					} catch (error) {
						console.error(
							`ロール情報の抽出に失敗しました (${entry.name}): ${error}`,
						);
					}
				}
			}

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
			const filePath = join(this.rolesDir, `${roleId}.md`);

			// ファイルが存在するか確認
			if (!(await exists(filePath))) {
				return null;
			}

			// ファイルの内容を読み込む
			const content = await Deno.readTextFile(filePath);

			// ロール情報を抽出
			const { name, description, context } = this.extractRoleInfo(content);

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
