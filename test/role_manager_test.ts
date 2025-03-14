import {
	assertEquals,
	assertNotEquals,
	assertExists,
} from "https://deno.land/std/testing/asserts.ts";
import { RoleManager } from "../role_manager.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { exists } from "https://deno.land/std/fs/mod.ts";

// テスト用のモックディレクトリとファイルを作成
async function setupTestRoles(): Promise<string> {
	const testDir = join(Deno.cwd(), "test", "test_roles");

	// テストディレクトリが存在しない場合は作成
	if (!(await exists(testDir))) {
		await Deno.mkdir(testDir, { recursive: true });
	}

	// テスト用のロールファイルを作成
	const testRoles = [
		{
			id: "test_engineer",
			content: `# テストエンジニア

テスト用のエンジニアロールです。

## 役割
- テスト
- 検証
`,
		},
		{
			id: "test_writer",
			content: `# テストライター

テスト用のライターロールです。

## 役割
- 文章作成
- 編集
`,
		},
		{
			id: "invalid_role",
			content: `このロールには見出しがありません。
      
これは無効なロールファイルです。`,
		},
	];

	// テストロールファイルを書き込み
	for (const role of testRoles) {
		await Deno.writeTextFile(join(testDir, `${role.id}.md`), role.content);
	}

	return testDir;
}

// テスト後のクリーンアップ
async function cleanupTestRoles(testDir: string) {
	try {
		await Deno.remove(testDir, { recursive: true });
	} catch (error) {
		console.error(`テストディレクトリの削除に失敗しました: ${error}`);
	}
}

Deno.test("RoleManager - listRoles", async () => {
	const testDir = await setupTestRoles();
	try {
		const roleManager = new RoleManager(testDir);
		const result = await roleManager.listRoles();

		// 結果の検証
		assertEquals(result.roles.length, 3, "正しいロール数が返されるべき");

		// テストエンジニアロールの検証
		const engineerRole = result.roles.find((r) => r.id === "test_engineer");
		assertExists(engineerRole, "test_engineerロールが存在するべき");
		assertEquals(
			engineerRole.name,
			"テストエンジニア",
			"正しいロール名が抽出されるべき",
		);
		assertEquals(
			engineerRole.description,
			"テスト用のエンジニアロールです。",
			"正しい説明が抽出されるべき",
		);

		// テストライターロールの検証
		const writerRole = result.roles.find((r) => r.id === "test_writer");
		assertExists(writerRole, "test_writerロールが存在するべき");
		assertEquals(
			writerRole.name,
			"テストライター",
			"正しいロール名が抽出されるべき",
		);

		// 無効なロールの検証
		const invalidRole = result.roles.find((r) => r.id === "invalid_role");
		assertExists(invalidRole, "invalid_roleロールが存在するべき");
		assertEquals(
			invalidRole.name,
			"不明なロール",
			"見出しがない場合はデフォルト名が使用されるべき",
		);
	} finally {
		await cleanupTestRoles(testDir);
	}
});

Deno.test("RoleManager - getRole", async () => {
	const testDir = await setupTestRoles();
	try {
		const roleManager = new RoleManager(testDir);

		// 存在するロールの取得
		const engineerRole = await roleManager.getRole("test_engineer");
		assertExists(engineerRole, "test_engineerロールが取得できるべき");
		assertEquals(engineerRole.id, "test_engineer", "正しいIDが設定されるべき");
		assertEquals(
			engineerRole.name,
			"テストエンジニア",
			"正しいロール名が抽出されるべき",
		);
		assertEquals(
			engineerRole.description,
			"テスト用のエンジニアロールです。",
			"正しい説明が抽出されるべき",
		);
		assertExists(engineerRole.context, "コンテキストが存在するべき");

		// 存在しないロールの取得
		const nonExistentRole = await roleManager.getRole("non_existent");
		assertEquals(nonExistentRole, null, "存在しないロールはnullを返すべき");
	} finally {
		await cleanupTestRoles(testDir);
	}
});

Deno.test("RoleManager - extractRoleInfo", async () => {
	const testDir = await setupTestRoles();
	try {
		const roleManager = new RoleManager(testDir);

		// プライベートメソッドをテストするためのハック
		type ExtractRoleInfoFn = (content: string) => {
			name: string;
			description: string;
			context: string;
		};

		// プライベートメソッドにアクセスするためのキャスト
		const extractRoleInfo = (
			roleManager as unknown as {
				extractRoleInfo: ExtractRoleInfoFn;
			}
		).extractRoleInfo.bind(roleManager);

		// 正常なMarkdownの解析
		const normalMarkdown = `# テストロール

これはテスト用の説明です。

## セクション1
- 項目1
- 項目2
`;
		const normalResult = extractRoleInfo(normalMarkdown);
		assertEquals(
			normalResult.name,
			"テストロール",
			"正しいロール名が抽出されるべき",
		);
		assertEquals(
			normalResult.description,
			"これはテスト用の説明です。",
			"正しい説明が抽出されるべき",
		);
		assertEquals(
			normalResult.context,
			normalMarkdown,
			"コンテキストは元のMarkdownと同じであるべき",
		);

		// 見出しがないMarkdownの解析
		const noHeadingMarkdown = `これは見出しのないMarkdownです。

説明のみがあります。
`;
		const noHeadingResult = extractRoleInfo(noHeadingMarkdown);
		assertEquals(
			noHeadingResult.name,
			"不明なロール",
			"見出しがない場合はデフォルト名が使用されるべき",
		);
		assertEquals(
			noHeadingResult.description,
			"これは見出しのないMarkdownです。",
			"最初の段落が説明として使用されるべき",
		);

		// 複数段落の説明を持つMarkdownの解析
		const multiParaMarkdown = `# 複数段落ロール

これは最初の段落です。

これは2つ目の段落です。これは説明には含まれないはずです。

## セクション
内容
`;
		const multiParaResult = extractRoleInfo(multiParaMarkdown);
		assertEquals(
			multiParaResult.name,
			"複数段落ロール",
			"正しいロール名が抽出されるべき",
		);
		assertEquals(
			multiParaResult.description,
			"これは最初の段落です。",
			"最初の段落のみが説明として使用されるべき",
		);
	} finally {
		await cleanupTestRoles(testDir);
	}
});
