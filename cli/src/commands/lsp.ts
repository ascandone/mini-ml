import {
  Span,
  SpannedAst,
  TypedAst,
  UnboundVariableError,
  parse,
  prelude,
  typePPrint,
  typecheck,
} from "@mini-ml/core";
import { Type, UnifyError } from "@mini-ml/core/dist/unify";
import {
  DiagnosticSeverity,
  MarkupKind,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

const documents = new TextDocuments(TextDocument);
const connection =
  // @ts-ignore
  createConnection();

const docs = new Map<string, [TextDocument, SpannedAndTyped]>();

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

function spanContains([start, end]: Span, offset: number) {
  return start <= offset && end >= offset;
}

function findTypeByOffset<T>(
  ast: SpannedAndTyped<T>,
  offset: number
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
  }
}

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

export function lsp() {
  documents.listen(connection);
  connection.listen();
}

type SpannedAndTyped<T = {}> = SpannedAst<T> & TypedAst<T>;
