import * as fs from "@std/fs";
import { basename } from "@std/path";

declare global {
  interface ImportMeta {
    main: boolean;
  }
}

const ROLES_DIR = "./roles";
const OUTPUT_FILE = "./embedded_roles.ts";

async function generateEmbeddedRoles() {
  const roles: { id: string; content: string }[] = [];

  for await (const entry of fs.walk(ROLES_DIR, { exts: [".md"] })) {
    const content = await Deno.readTextFile(entry.path);
    const id = basename(entry.path, ".md");
    roles.push({ id, content });
  }

  const output = `/**
 * 埋め込みロールファイル
 * ビルド時にロールファイルの内容を直接コードに組み込む
 */

export interface EmbeddedRole {
  id: string;
  content: string;
}

export const embeddedRoles: EmbeddedRole[] = ${JSON.stringify(roles, null, 2)};
`;

  await Deno.writeTextFile(OUTPUT_FILE, output);
  console.log(`Generated ${OUTPUT_FILE} with ${roles.length} roles`);
}

if (import.meta.main) {
  await generateEmbeddedRoles();
}

function walk(ROLES_DIR: string, arg1: { exts: string[] }) {
  throw new Error("Function not implemented.");
}
