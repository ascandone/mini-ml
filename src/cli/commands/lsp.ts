import {
  DiagnosticSeverity,
  MarkupKind,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Span, SpannedAst, parse } from "../../parser";
import { Type, UnifyError } from "../../unify";
import { typePPrint } from "../../type/pretty-printer";
import { TypedAst, UnboundVariableError, typecheck } from "../../typecheck";
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

export function lsp() {
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

    try {
      const typed = typecheck(parsed.value, prelude);

      docs.set(change.document.uri, [change.document, typed]);

      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: [],
      });
    } catch (e) {
      if (e instanceof UnboundVariableError) {
        const et = e as UnboundVariableError<SpannedAst>;
        const [start, end] = et.node.span;

        connection.sendDiagnostics({
          uri: change.document.uri,
          diagnostics: [
            {
              message: e.message,
              source: "Typecheck",
              severity: DiagnosticSeverity.Error,
              range: {
                start: change.document.positionAt(start),
                end: change.document.positionAt(end),
              },
            },
          ],
        });
        return;
      }

      if (e instanceof UnboundVariableError) {
        const et = e as UnboundVariableError<SpannedAst>;
        const [start, end] = et.node.span;

        connection.sendDiagnostics({
          uri: change.document.uri,
          diagnostics: [
            {
              message: e.message,
              source: "Typecheck",
              severity: DiagnosticSeverity.Error,
              range: {
                start: change.document.positionAt(start),
                end: change.document.positionAt(end),
              },
            },
          ],
        });
        return;
      }

      if (e instanceof UnifyError) {
        connection.sendDiagnostics({
          uri: change.document.uri,
          diagnostics: [
            {
              message: `
Cannot unify following types:

${typePPrint(e.left)}
${typePPrint(e.right)}
`,
              source: "Typecheck",
              severity: DiagnosticSeverity.Error,
              range: {
                start: change.document.positionAt(0),
                end: change.document.positionAt(0),
              },
            },
          ],
        });
        return;
      }

      if (e instanceof UnifyError) {
        connection.sendDiagnostics({
          uri: change.document.uri,
          diagnostics: [
            {
              message: `
${e.message}

${typePPrint(e.left)}
${typePPrint(e.right)}
`,
              source: "Typecheck",
              severity: DiagnosticSeverity.Error,
              range: {
                start: change.document.positionAt(0),
                end: change.document.positionAt(0),
              },
            },
          ],
        });
        return;
      }

      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: [
          {
            message: (e as Error).message,
            source: "Typecheck",
            range: {
              start: change.document.positionAt(0),
              end: change.document.positionAt(0),
            },
          },
        ],
      });
    }
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
