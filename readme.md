[![CI](https://github.com/ascandone/mini-ml/actions/workflows/ci.yml/badge.svg)](https://github.com/ascandone/mini-ml/actions/workflows/ci.yml) [![codecov](https://codecov.io/gh/ascandone/mini-ml/graph/badge.svg?token=MSbSsCYLhn)](https://codecov.io/gh/ascandone/mini-ml)

### Mini-ml

A minimal implementation of an Hindley–Milner type checker, with LSP integration (see the [vscode language client](https://github.com/ascandone/mini-ml-vscode))

_Example:_

```ml
let is_even n =
  if n == 0 then
    true
  else if n == 1 then
    false
  else
    not (is_even (n - 1))
in
is_even 42
```

> Inferred type: `Bool`
