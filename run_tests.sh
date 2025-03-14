#!/bin/bash

# MCPロール提供サーバーのテストスクリプト
# このスクリプトは、すべてのテストを順番に実行します。

echo "=== MCPロール提供サーバーのテスト ==="
echo ""

# 単体テスト（RoleManager）
echo "1. 単体テスト（RoleManager）を実行中..."
deno task test:unit
if [ $? -ne 0 ]; then
  echo "単体テストが失敗しました。"
  exit 1
fi
echo "単体テスト完了"
echo ""

# 簡易テスト
echo "2. 簡易テストを実行中..."
deno task test:simple
if [ $? -ne 0 ]; then
  echo "簡易テストが失敗しました。"
  exit 1
fi
echo "簡易テスト完了"
echo ""

# クライアントテスト
echo "3. クライアントテストを実行中..."
deno task test:client
if [ $? -ne 0 ]; then
  echo "クライアントテストが失敗しました。"
  exit 1
fi
echo "クライアントテスト完了"
echo ""

echo "すべてのテストが正常に完了しました！"