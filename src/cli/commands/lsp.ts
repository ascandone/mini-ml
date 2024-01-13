import {
  DiagnosticSeverity,
  MarkupKind,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Span, SpannedAst, parse } from "../../parser";
import { Type } from "../../unify";
import { typeErrorPPrint, typePPrint } from "../../typecheck/pretty-printer";
import { TypedAst, typecheck } from "../../typecheck";
import { prelude } from "../../prelude";

const documents = new TextDocuments(TextDocument);
const docs = new Map<string, [TextDocument, SpannedAndTyped]>();

function spanContains([start, end]: Span, offset: number) {
  return start <= offset && end >= offset;
}

function findTypeByOffset<T>(
  ast: SpannedAndTyped<T>,
  offset: number,
): Type | undefined {
  if (!spanContains(ast.span, offset)) {
    return;
  }

  switch (ast.type) {
    case "constant":
    case "ident":
      return ast.$;
    case "application":
      return (
        findTypeByOffset(ast.caller, offset) ??
        findTypeByOffset(ast.arg, offset)
      );
    case "let":
      if (spanContains(ast.binding.span, offset)) {
        return ast.binding.$;
      }
      return (
        findTypeByOffset(ast.definition, offset) ??
        findTypeByOffset(ast.body, offset)
      );
    case "abstraction":
      if (spanContains(ast.param.span, offset)) {
        return ast.param.$;
      }
      return findTypeByOffset(ast.body, offset);
    case "if":
      return (
        findTypeByOffset(ast.condition, offset) ??
        findTypeByOffset(ast.then, offset) ??
        findTypeByOffset(ast.else, offset)
      );
  }
}

export function lspCmd() {
  const connection =
    // @ts-ignore
    createConnection();

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      // inlayHintProvider: true,
      // codeLensProvider: {
      //   resolveProvider: true,
      // },
      // documentSymbolProvider: true,
    },
  }));

  documents.onDidChangeContent((change) => {
    const src = change.document.getText();
    const parsed = parse(src);
    if (!parsed.ok) {
      const interval = parsed.matchResult.getInterval();

      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: [
          {
            message: parsed.matchResult.message ?? "Parsing error",
            source: "Parsing",
            severity: DiagnosticSeverity.Error,
            range: {
              start: change.document.positionAt(interval.startIdx),
              end: change.document.positionAt(interval.endIdx),
            },
          },
        ],
      });
      return;
    }

    const [typed, errors] = typecheck(parsed.value, prelude);
    docs.set(change.document.uri, [change.document, typed]);
    connection.sendDiagnostics({
      uri: change.document.uri,
      diagnostics: errors.map((e) => {
        const [start, end] = e.node.span;

        return {
          message: typeErrorPPrint(e),
          source: "Typecheck",
          severity: DiagnosticSeverity.Error,
          range: {
            start: change.document.positionAt(start),
            end: change.document.positionAt(end),
          },
        };
      }),
    });
  });

  connection.onHover(({ textDocument, position }) => {
    const pair = docs.get(textDocument.uri);
    if (pair === undefined) {
      return undefined;
    }

    const [doc, ast] = pair;

    const offset = doc.offsetAt(position);

    const $ = findTypeByOffset(ast, offset);
    if ($ === undefined) {
      return undefined;
    }
    const tpp = typePPrint($);

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `\`\`\`
${tpp}
\`\`\``,
      },
    };
  });

  documents.listen(connection);
  connection.listen();
}

type SpannedAndTyped<T = {}> = SpannedAst<T> & TypedAst<T>;
