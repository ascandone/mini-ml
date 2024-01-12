[![CI](https://github.com/ascandone/mini-ml/actions/workflows/ci.yml/badge.svg)](https://github.com/ascandone/mini-ml/actions/workflows/ci.yml)

### Mini-ml

A minimal implementation of an Hindley–Milner type checker, with LSP integration

_Example:_

```ml
let is_even n =
  if n == 0
  then true
  else not (is_even (n - 1))
in
is_even 42
```

> Inferred type: `Bool`
