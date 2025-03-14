/**
 * MCPロール提供サーバーの簡易テスト
 * このスクリプトは、サーバーを直接起動せずにRoleManagerの機能をテストします。
 */

import {
	assertEquals,
	assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { RoleManager } from "../role_manager.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

// デフォルトとユーザー設定のロールディレクトリを取得
async function getRolesDir(): Promise<string> {
	const defaultDir = "./roles";

	// ホームディレクトリの取得
	const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
	if (!homeDir) {
		console.log(`デフォルトのロールディレクトリを使用します: ${defaultDir}`);
		return defaultDir;
	}

	const userDir = join(homeDir, ".config", "mcp-roles", "roles");

	// ユーザー設定のディレクトリが存在する場合はそれを使用し、
	// 存在しない場合はデフォルトのディレクトリを使用
	if (await exists(userDir)) {
		console.log(`ユーザー設定のロールディレクトリを使用します: ${userDir}`);
		return userDir;
	}

	console.log(`デフォルトのロールディレクトリを使用します: ${defaultDir}`);
	return defaultDir;
}

// RoleManagerの基本機能テスト
Deno.test("RoleManager - 実際のロールディレクトリでのテスト", async () => {
	const rolesDir = await getRolesDir();
	const roleManager = new RoleManager(rolesDir);

	// ロール一覧の取得
	const roleList = await roleManager.listRoles();
	assertExists(roleList.roles, "ロール一覧が取得できるべき");
	assertEquals(
		roleList.roles.length > 0,
		true,
		"少なくとも1つのロールが存在するべき",
	);

	// エンジニアロールの取得
	const engineerRole = await roleManager.getRole("engineer");
	assertExists(engineerRole, "engineerロールが取得できるべき");
	assertEquals(engineerRole.id, "engineer", "正しいIDが設定されるべき");
	assertEquals(
		engineerRole.name,
		"ソフトウェアエンジニア",
		"正しいロール名が抽出されるべき",
	);
	assertExists(engineerRole.description, "説明が存在するべき");
	assertExists(engineerRole.context, "コンテキストが存在するべき");

	// 存在しないロールの取得
	const nonExistentRole = await roleManager.getRole("non_existent_role");
	assertEquals(nonExistentRole, null, "存在しないロールはnullを返すべき");
});

// 各ロールファイルの形式検証
Deno.test("RoleManager - 全ロールファイルの形式検証", async () => {
	const rolesDir = await getRolesDir();
	const roleManager = new RoleManager(rolesDir);
	const roleList = await roleManager.listRoles();

	for (const roleInfo of roleList.roles) {
		const role = await roleManager.getRole(roleInfo.id);
		assertExists(role, `${roleInfo.id}ロールが取得できるべき`);
		assertExists(role.name, `${roleInfo.id}ロールは名前を持つべき`);
		assertExists(role.description, `${roleInfo.id}ロールは説明を持つべき`);
		assertExists(role.context, `${roleInfo.id}ロールはコンテキストを持つべき`);

		// 名前と説明が空でないことを確認
		assertEquals(
			role.name.trim() !== "",
			true,
			`${roleInfo.id}ロールの名前は空でないべき`,
		);
		assertEquals(
			role.description.trim() !== "",
			true,
			`${roleInfo.id}ロールの説明は空でないべき`,
		);
	}
});

// ユーザー設定ディレクトリのテスト（存在する場合のみ）
Deno.test("RoleManager - ユーザー設定ディレクトリのテスト", async () => {
	// ホームディレクトリの取得
	const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
	if (!homeDir) {
		console.log(
			"ホームディレクトリが見つからないため、このテストをスキップします",
		);
		return;
	}

	const userDir = join(homeDir, ".config", "mcp-roles", "roles");

	// ユーザー設定のディレクトリが存在しない場合はテストをスキップ
	if (!(await exists(userDir))) {
		console.log(
			`ユーザー設定ディレクトリ ${userDir} が存在しないため、このテストをスキップします`,
		);
		return;
	}

	// ユーザー設定ディレクトリが存在する場合はテスト実行
	const roleManager = new RoleManager(userDir);

	// ロール一覧の取得
	const roleList = await roleManager.listRoles();
	assertExists(roleList.roles, "ユーザー設定のロール一覧が取得できるべき");

	console.log(
		`ユーザー設定ディレクトリ ${userDir} から ${roleList.roles.length} 個のロールを読み込みました`,
	);

	// 各ロールの基本的な検証
	for (const roleInfo of roleList.roles) {
		const role = await roleManager.getRole(roleInfo.id);
		assertExists(role, `ユーザー設定の ${roleInfo.id} ロールが取得できるべき`);
		assertExists(
			role.name,
			`ユーザー設定の ${roleInfo.id} ロールは名前を持つべき`,
		);
		assertExists(
			role.description,
			`ユーザー設定の ${roleInfo.id} ロールは説明を持つべき`,
		);
	}
});
