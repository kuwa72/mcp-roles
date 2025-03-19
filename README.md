# MCP Roles - 単一ファイル版

Model Context Protocol (MCP)規格に準拠したロール提供サーバー。
このサーバーは、事前に定義したロール（役割）をLLMに提供します。

## 特徴

- 単一ファイルで実装された軽量なMCPサーバー
- マークダウン形式のロール定義をサポート
- デフォルトロールとユーザーカスタムロールの両方に対応

## 使い方

### サーバーの起動

```bash
deno run --allow-read --allow-env main.ts
```

詳細なログ出力を有効にする場合:

```bash
deno run --allow-read --allow-env main.ts --verbose
```

### バイナリのコンパイル

```bash
deno compile --allow-read --allow-env main.ts -o mcp-roles
# または
deno task compile
```

### クロスプラットフォームビルド

```bash
deno task build
```

## ロールの定義

ロールは `roles/` ディレクトリ内の Markdown ファイルで定義します。
各ファイル名（拡張子を除く）がロールIDとなります。

カスタムロールは `~/.config/mcp-roles/roles/` に配置することもできます。

### ロールファイルの形式

以下のテンプレートに従ってロールを定義することを推奨します。

```markdown
# 役割: [役割名]
あなたは[役割の詳細な説明]です。

# 知識と専門領域
- [関連する専門知識や背景]
- [役割に関連する特定のスキル]
- [その他の関連専門分野]

# コミュニケーションスタイル
- [話し方や応答の特徴]
- [使用すべき/避けるべき言葉遣いや表現]
- [コミュニケーション上の重要な注意点]

# 対応方法
1. [情報の提供方法や問題解決アプローチ]
2. [質問への応答の構造や詳細さ]
3. [タスク実行時のステップやプロセス]

# 制約事項
- [役割において避けるべきこと]
- [対応できない内容や範囲]
- [説明時の注意点や限界]
```

LLMは自然言語を理解するので、テンプレートをベースにしつつも、日常使っている言語で記述してください。
良い書き方については直接AIに相談することも効果的です。

## MCP ツール

このサーバーは以下のMCPツールを提供します:

- `get-role`: 特定のロール詳細を取得します
- `list-roles`: 利用可能なロール一覧を取得します
