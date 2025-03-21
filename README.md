# MCP Roles

Model Context Protocol (MCP)規格に準拠したロール提供サーバー。
このサーバーは、事前に定義したロール（役割）をLLMに提供します。

## 特徴

- 単一バイナリで配布可能な軽量なMCPサーバー
- マークダウン形式のロール定義をサポート
- ビルド時にロールファイルを埋め込み

## 使い方

### 開発時

```bash
# ロールファイルの変更をembedded_roles.tsに反映
deno task generate

# サーバーの起動
deno task start
```

詳細なログ出力を有効にする場合:

```bash
deno task start -- --verbose
```

### バイナリのビルド

```bash
# ロールファイルを埋め込んでビルド
deno task compile
```

### クロスプラットフォームビルド

```bash
# Mac、Windows、Linux用のバイナリをビルド
deno task build
```

## ロールの定義

`roles/` ディレクトリ内にマークダウンファイルとしてロールを定義します。
各ファイル名（拡張子を除く）がロールIDとなります。

例えば、`roles/writer.md`の場合、ロールIDは`writer`となります。

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

## ビルドプロセス

1. `roles/`ディレクトリ内のロールファイルを`embedded_roles.ts`に自動的に取り込みます。
2. ビルド時にロールがバイナリに埋め込まれるため、実行時に外部ファイルを読み込む必要がありません。
3. 結果として、単一のバイナリで配布可能になります。

このサーバーは以下のMCPツールを提供します:

- `get-role`: 特定のロール詳細を取得します
- `list-roles`: 利用可能なロール一覧を取得します
