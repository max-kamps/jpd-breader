// // type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
// //     ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
// //     : S;

// type FieldArray<T> = readonly (keyof T)[];
// type PickedFields<T, F> = F extends FieldArray<T> ? Pick<T, F[number]> : never;

// type Token<TF extends FieldArray<_Token>, VF extends FieldArray<Vocabulary>> = PickedFields<_Token, TF> &
//     ('vocabularyIndex' extends TF[number] ? { vocabulary: PickedFields<Vocabulary, VF> } : object);

// function camelToSnake(string: string): string {
//     return string.replaceAll(/([A-Z])(?=[^A-Z]|$)/g, (m, p1) => `_${p1.toLowerCase()}`);
// }

// export async function parse<TokenFields extends FieldArray<_Token>, VocabFields extends FieldArray<Vocabulary>>(
//     token: string,
//     text: string | string[],
//     tokenFields: TokenFields,
//     vocabularyFields: VocabFields,
// ): Promise<Token<TokenFields, VocabFields>[]> {
//     const data: { tokens: any[][]; vocabulary: any[][] } = await response.json();

//     // Turn the field arrays into objects
//     const vocab = data.vocabulary.map(
//         fields => Object.fromEntries(fields.map((value, i) => [vocabularyFields[i], value])) as Vocabulary,
//     );

//     const tokens = data.tokens.map(fields => {
//         const token = Object.fromEntries(fields.map((value, i) => [tokenFields[i], value])) as Token<
//             TokenFields,
//             VocabFields
//         >;
//         if (Object.hasOwn(token, 'vocabularyIndex')) {
//             // Safety: This is safe because we check for vocabularyIndex
//             // Typescript is not smart enough to realize what we are doing
//             (token as any).vocabulary = vocab[token.vocabularyIndex];
//         }
//         return token;
//     });

//     return tokens;
// }
