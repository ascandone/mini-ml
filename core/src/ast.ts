export type Const = null | boolean | number | string;
export type Ast<Meta = {}> = Meta &
  (
    | {
        type: "constant";
        value: Const;
      }
    | {
        type: "ident";
        ident: string;
      }
    | {
        type: "abstraction";
        param: { name: string } & Meta;
        body: Ast<Meta>;
      }
    | {
        type: "application";
        caller: Ast<Meta>;
        arg: Ast<Meta>;
      }
    | {
        type: "let";
        binding: { name: string } & Meta;
        definition: Ast<Meta>;
        body: Ast<Meta>;
      }
  );
