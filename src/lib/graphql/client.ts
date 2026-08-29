type GraphQLErrorResponse = {
  message: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLErrorResponse[];
};

export type TypedOperation<TData, TVariables extends object | undefined = undefined> = {
  query: string;
  _result?: TData;
  _variables?: TVariables;
};

export function defineOperation<TData, TVariables extends object | undefined = undefined>(
  query: string,
): TypedOperation<TData, TVariables> {
  return { query };
}

export async function graphqlRequest<TData, TVariables extends object | undefined>(
  operation: TypedOperation<TData, TVariables>,
  ...[variables]: TVariables extends undefined ? [] : [variables: TVariables]
): Promise<TData> {
  const response = await fetch('/graphql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: operation.query, variables }),
  });

  if (!response.ok) {
    throw new Error(`The server returned ${response.status}. Please try again.`);
  }

  const result = (await response.json()) as GraphQLResponse<TData>;
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(' '));
  }
  if (!result.data) throw new Error('The server returned no data.');

  return result.data;
}
