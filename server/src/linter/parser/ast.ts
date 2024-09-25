import { Token, LineToken, joinTokenValues, filterOutTokens } from './token';
import { MatchedRule } from './matches';
import { findToken, sortTokens } from './utils';
import { StatementType, JoinType, LogicalOperator, ComparisonOperator } from './enums';

// region base types

/**
 * Abstract Syntax Tree (AST) base class.
 * 
 * This class serves as a base for all AST nodes in the BigQuery SQL Formatter.
 * It contains common properties that are shared across different types of AST nodes.
 * 
 * @abstract
 * @property {Token[]} tokens - An array of tokens associated with this AST node.
 * @property {string | null} alias - An optional alias for the AST node.
 * @property {number | null} lineNumber - The line number where this AST node starts.
 * @property {number | null} startIndex - The start index of this AST node in the source code.
 * @property {number | null} endIndex - The end index of this AST node in the source code.
 */
abstract class AST {
  tokens: Token[] = [];
  alias: string | null = null;
  lineNumber: number | null = null;
  startIndex: number | null = null;
  endIndex: number | null = null;

  constructor(tokens: Token[] = []) {
    this.tokens = sortTokens(tokens);

    if (tokens.length > 0) {
      this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
      this.lineNumber = filterOutTokens(tokens, ['punctuation.whitespace.leading.sql',
        'punctuation.whitespace.trailing.sql',
        'punctuation.whitespace.sql',
        'punctuation.separator.comma.sql'])[0].lineNumber;
      this.startIndex = tokens[0].startIndex;
      this.endIndex = tokens[tokens.length - 1].endIndex;
    }    
  }
}

/**
 * Represents an abstract syntax tree (AST) node with an associated value.
 * 
 * @template T - The type of the value associated with this AST node.
 * 
 * @extends AST
 * 
 * @property {T | null} value - The value associated with this AST node, initialized to null.
 * 
 * @remarks
 * This class extends the base AST class and adds a value property. It also provides a constructor
 * that initializes various properties based on the provided tokens.
 * 
 * @constructor
 * @param {Token[]} tokens - An array of Token objects that represent the tokens to be parsed.
 * 
 * @example
 * ```typescript
 * const tokens: Token[] = [...];
 * const astNode = new ASTWithValue<string>(tokens);
 * ```
 */
abstract class ASTWithValue<T> extends AST {
  value: T | null = null;
}

// endregion base types

// region functions
/**
 * Extract the statement type and object from the tokens, return an
 * object representing a column.
 * @param matchedRule 
 * @returns Column
 */
function createColumn(matchedRule: MatchedRule): Column {
  if (matchedRule.rule?.type === 'case') {
    return new CaseStatementAST(matchedRule);
  } else if (matchedRule.rule?.type === 'function') {
    return new ColumnFunctionAST(matchedRule);
  } else if (matchedRule.rule?.type === 'string') {
    return new StringAST(matchedRule.tokens);
  } else if (matchedRule.rule?.type === 'number') {
    return new NumberAST(matchedRule.tokens);
  } else if (['comparison', 'keyword'].includes(matchedRule.rule?.type ?? '')) {
    return new KeywordAST(matchedRule.tokens);
  }
  return new ColumnAST(matchedRule);
}



/**
 * Extract the type of the statement from the tokenized source code
 * @param {LineToken[]} tokenizedLines The tokenized source code
 * @returns {[StatementType | undefined, ObjectAST | null]} The type of the statement and the object AST
 * @memberof Parser
 * @name _extractStatementType
 */
function extractStatementType(tokens: Token[]): [StatementType | undefined, ObjectAST | null] {
  let type: StatementType = StatementType.SELECT;
  let objectAST = null;

  for (const searchString of ["meta.dml.sql", "meta.ddl.sql"]) {
    const targetTokens: Token[] = tokens.filter((token) => token.scopes.some((scope) => scope.includes(searchString)));
    if (targetTokens.length > 0) {
      const typeToken = findToken(targetTokens, "keyword.dml.sql");
      type = StatementType[typeToken?.value?.split(' ')[0].toUpperCase() as keyof typeof StatementType];
      objectAST = new ObjectAST(targetTokens);
      break;
    }
  }
  return [type, objectAST];
}
// endregion functions

// region columns
/**
 * Represents a column in the SQL statement.
 * 
 * A column can be one of the following types:
 * - `ColumnAST`: Abstract Syntax Tree representation of a column.
 * - `ColumnFunctionAST`: Abstract Syntax Tree representation of a column function.
 * - `StatementAST`: Abstract Syntax Tree representation of a statement.
 * - `StringAST`: Abstract Syntax Tree representation of a string.
 * - `NumberAST`: Abstract Syntax Tree representation of a number.
 * - `KeywordAST`: Abstract Syntax Tree representation of a keyword.
 * - `CaseStatementAST`: Abstract Syntax Tree representation of a case statement.
 */
export type Column = ColumnAST | ColumnFunctionAST | StatementAST | StringAST | NumberAST | KeywordAST | CaseStatementAST;

/**
 * Represents a parameter that can be either a Column or a KeywordAST.
 * This type is used to define the possible types of parameters that can be passed to functions.
 */
export type FunctionParameter = Column | KeywordAST;


/**
 * Represents a column in the Abstract Syntax Tree (AST).
 * 
 * This class is used to parse and store information about a column, including its source, name, alias, and token positions.
 * 
 * @implements {AST}
 */
export class ColumnAST extends AST {
  source: string | null = null;
  column: string | null = null;
  
  constructor(matchedRule: MatchedRule) {
    super(matchedRule.tokens);

    if (matchedRule.matches != null && matchedRule.matches.length > 0) {
      this.tokens.push(...matchedRule.matches[0].tokens);
    }

    this.source = findToken(matchedRule.tokens, "entity.name.alias.sql")?.value ?? null;
    this.column = findToken(matchedRule.tokens, "entity.other.column.sql")?.value ?? null;
  }

  /**
   * Checks if the alias is redundant.
   * 
   * An alias is considered redundant if it is not null and is the same as the column name.
   * 
   * @returns {boolean} - Returns `true` if the alias is redundant, otherwise `false`.
   */
  redundantAlias(): boolean {
    if (this.alias === null) {
      return false;
    }

    if (this.column === null) {
      return false;
    }

    return this.column === this.alias;
  }

}

/**
 * Represents a column function in the Abstract Syntax Tree (AST).
 */
export class StringAST extends ASTWithValue<string> {

  /**
   * Constructs a new instance of the Column class.
   * 
   * @param tokens - An array of Token objects representing the tokens to be parsed.
   * 
   * @property tokens - Stores the provided tokens.
   * @property value - A string value derived from concatenating the token values.
   * @property alias - The alias of the column, if any, extracted from the tokens.
   * @property lineNumber - The line number of the first non-whitespace token.
   * @property startIndex - The start index of the first token.
   * @property endIndex - The end index of the last token.
   */
  constructor(tokens: Token[]) {
    super(tokens);
		if (tokens.length > 0) {
      this.value = joinTokenValues(tokens);
		}
  }
}

/**
 * Represents a number in the Abstract Syntax Tree (AST).
 */
export class NumberAST extends ASTWithValue<number> {

  /**
   * Constructs a new instance of the Column class.
   * 
   * @param tokens - An array of Token objects representing the tokens to be parsed.
   * 
   * @property tokens - Stores the provided tokens.
   * @property value - A numeric value derived from concatenating the token values.
   * @property alias - The alias of the column, if any, extracted from the tokens.
   * @property lineNumber - The line number of the first non-whitespace token.
   * @property startIndex - The start index of the first token.
   * @property endIndex - The end index of the last token.
   */
  constructor(tokens: Token[]) {
    super(tokens);
    this.value = Number(joinTokenValues(tokens));
  }
}

/**
 * Represents a keyword in the Abstract Syntax Tree (AST).
 */
export class KeywordAST extends ASTWithValue<string> {

  /**
   * Constructs a new instance of the Column class.
   * 
   * @param tokens 
   * 
   * @property tokens - Stores the provided tokens.
   * @property value - A string value derived from concatenating the token values.
   * @property alias - The alias of the column, if any, extracted from the tokens.
   * @property lineNumber - The line number of the first non-whitespace token.
   * @property startIndex - The start index of the first token.
   * @property endIndex - The end index of the last token.
   */
  constructor(tokens: Token[]) {
    super(tokens);
    this.value = joinTokenValues(tokens);
  }
}

/**
 * Represents a statement in the Abstract Syntax Tree (AST).
 */
export class OrderAST extends AST {
  column: Column | null = null;
  direction: string | null = null;
}

/**
 * Represents a statement in the Abstract Syntax Tree (AST).
 */
export class WindowAST extends AST {
  partition: Column[] = [];
  order: OrderAST[] = [];
  
  /**
   * Constructs an instance of the class.
   * 
   * @param match - The matched rule object containing parsing information.
   * 
   * The constructor processes the matched rule to extract and initialize
   * partition and order columns. It identifies the indices for "partition"
   * and "order" keywords within the matches, slices the matches accordingly,
   * and maps them to create column and order objects.
   * 
   * - `partition`: An array of columns derived from the matches between
   *   the "partition" and "order" keywords.
   * - `order`: An array of order objects derived from the matches after
   *   the "order" keyword.
   */
  constructor(match: MatchedRule) {
    super();
    const emptyMatch = { rule: null, tokens: [], matches: [] };
    const partitionByIndex = match.matches?.indexOf(match.matches?.find((match) => match.rule?.name === "keyword.partition") ?? emptyMatch) ?? 0;
    const orderByIndex = match.matches?.indexOf(match.matches?.find((match) => match.rule?.name === "keyword.order") ?? emptyMatch) ?? match.matches?.length;

    const partitionMatches = match.matches?.slice(partitionByIndex + 1, orderByIndex);
    const orderMatches = match.matches?.slice((orderByIndex ?? 0) + 1);

    this.partition = partitionMatches?.map((match) => createColumn(match) ?? null).filter((column) => column !== null) as Column[];
    this.order = orderMatches?.map((match) => new OrderAST()) ?? [];
  }
}


/**
 * Represents a statement in the Abstract Syntax Tree (AST).
 */
export class ColumnFunctionAST extends AST {
  function: string | null = null;
  parameters: FunctionParameter[] = [];
  over: WindowAST | null = null;
  
  /**
   * Constructs an instance of the class with the provided matched rule.
   * 
   * @param matchedRule - The matched rule containing tokens and matches to be processed.
   * 
   * The constructor performs the following operations:
   * - Extracts the function name from the matched rule tokens.
   * - Pushes all tokens from the matched rule to the instance's tokens array.
   * - Determines the line number and start index from the matched rule tokens.
   * - Processes special matches for columns being cast as a type and splits them into column and keyword tokens.
   * - Handles window functions that may contain an alias and adds the alias to the matched rule matches.
   * - Iterates over the matched rule matches to create appropriate AST nodes (e.g., ColumnAST, ColumnFunctionAST, StringAST, NumberAST, KeywordAST, WindowAST).
   * - Adds the created AST nodes to the instance's parameters and tokens arrays.
   * - Sets the end index based on the last token in the tokens array.
   */
  constructor(matchedRule: MatchedRule) {
    super(matchedRule.tokens);
    this.function = matchedRule.tokens.filter((token) => token.scopes.includes("meta.function.sql"))[0].value;

    // Special rules have been created for columns being cast as a type - these need split into column
    // and keyword and inserted into the matches array.
    const specialMatches = matchedRule.matches?.filter((match) => match.rule?.type === 'special') ?? [];

    specialMatches.forEach((match) => {
      const indexOfMatch = matchedRule.matches?.indexOf(match) ?? 0;
      const slicePoint = match.tokens.findIndex((token) => token.scopes.includes("keyword.as.sql"));

      const keywordTokens = match.tokens.slice(slicePoint);
      const columnTokens = match.tokens.slice(0, slicePoint);
      matchedRule.matches?.splice(indexOfMatch, 1, {
        "rule": {
          "type": "column",
          "name": "special.column",
          "scopes": [],
          "lookahead": 0,
          "negativeLookahead": null,
          "recursive": false,
          "children": null,
          "end": null
        }, "tokens": columnTokens
      });

      matchedRule.matches?.splice(indexOfMatch + 1, 0, {
        "rule": {
          "type": "keyword",
          "name": "special.keyword",
          "scopes": [],
          "lookahead": 0,
          "negativeLookahead": null,
          "recursive": false,
          "children": null,
          "end": null
        }, "tokens": keywordTokens
      });

    });

    // window functions may contain an alias - pop it to the
    // function level matches
    const window: MatchedRule | null = matchedRule.matches?.find((match) => match.rule?.type === 'over') ?? null;
    if (window) {
      const alias = window.matches?.find((match) => match.rule?.type === 'alias') ?? null;
      if (alias) {
        matchedRule.matches?.push(alias);
      }
    }


    for (const match of matchedRule.matches ?? []) {
      let parameter: FunctionParameter | null = null;
      if (match.rule?.type === 'column') {
        parameter = new ColumnAST(match);
      } else if (match.rule?.type === 'function') {
        parameter = new ColumnFunctionAST(match);
      } else if (match.rule?.type === 'string') {
        parameter = new StringAST(match.tokens);
      } else if (match.rule?.type === 'number') {
        parameter = new NumberAST(match.tokens);
      } else if (['comparison', 'keyword', 'operator'].includes(match.rule?.type ?? '')) {
        parameter = new KeywordAST(match.tokens);
      } else if (match.rule?.type === 'over') {
        this.over = new WindowAST(match);
      } else if (match.rule?.type === 'alias') {
        this.alias = findToken(match.tokens, "entity.name.tag")?.value ?? null;
        this.tokens.push(...match.tokens);
      }
      if (parameter) {
        this.parameters.push(parameter);
        this.tokens.push(...parameter.tokens);
      }
    }
  }
}


/**
 * Represents a statement in the Abstract Syntax Tree (AST).
 */
export class CaseStatementWhenAST extends AST {
  when: ComparisonGroupAST | null = null;
  then: Column | null = null;

  /**
   * Constructs an instance of the AST node with the provided matched rules.
   *
   * @param when - The matched rule representing the condition.
   * @param then - The matched rule representing the consequence.
   */
  constructor(when: MatchedRule, then: MatchedRule) {

    const tokens = [...when.tokens, ...then.tokens];
    super(tokens);

    this.when = new ComparisonGroupAST(when.matches ?? []);
    this.then = new ColumnAST(then);
  }
}

/**
 * Represents a statement in the Abstract Syntax Tree (AST).
 */
export class CaseStatementAST extends AST {
  when: CaseStatementWhenAST[] = [];
  else: Column | null = null;
  
  /**
   * Constructs an instance of the class with the provided matched rule.
   * 
   * @param matchedRule - The matched rule containing tokens and matches to be processed.
   * 
   * The constructor performs the following operations:
   * - Extracts the when and then matches from the matched rule.
   * - Iterates over the when matches to create CaseStatementWhenAST objects.
   * - Creates a Column object for the else match, if present.
   * - Extracts the alias from the alias match, if present.
   */
  constructor(matchedRule: MatchedRule) {
    super(matchedRule.tokens);

    const whenMatches = matchedRule.matches?.filter((match) => match.rule?.type === "when") ?? [];
    const thenMatches = matchedRule.matches?.filter((match) => match.rule?.type === "then") ?? [];
    const elseMatch = matchedRule.matches?.find((match) => match.rule?.type === "else") ?? null;
    const aliasMatch = matchedRule.matches?.find((match) => match.rule?.type === "alias") ?? null;

    for (let i = 0; i < whenMatches.length; i++) {
      this.when.push(new CaseStatementWhenAST(whenMatches[i], thenMatches[i]));
    }

    if (elseMatch) {
      this.else = createColumn((elseMatch.matches ?? [{ rule: null, tokens: [] }])[0]);
    }

    if (aliasMatch) {
      this.alias = findToken(aliasMatch.tokens, "entity.name.tag")?.value ?? null;
    }
  }
}
// endregion columns

// region comparison
/**
 * Represents a comparison in the Abstract Syntax Tree (AST).
 */
export class ComparisonAST extends AST {
  logicalOperator: LogicalOperator | null = null;
  left: Column | ArrayAST | null = null;
  operator: ComparisonOperator | null = null;
  right: Column | ArrayAST | null = null;
  
  /**
   * 
   * Constructs a new instance of the class.
   * 
   * @param comparison 
   * @param tokens 
   * 
   * This constructor initializes the following properties:
   * - `tokens`: Stores the provided tokens.
   * - `left`: The left side of the comparison.
   * - `operator`: The comparison operator.
   * - `right`: The right side of the comparison.
   * - `logicalOperator`: The logical operator that connects this comparison to the next.
   * - `lineNumber`: The line number of the first non-whitespace token.
   * - `startIndex`: The start index of the first token.
   * - `endIndex`: The end index of the last token.
   */
  constructor(comparison: Comparison, tokens: Token[]) {
    super(tokens);
    this.left = comparison.left;
    this.operator = comparison.operator;
    this.right = comparison.right;
    this.logicalOperator = comparison.logicalOperator;
  }
}


/**
 * Represents a comparison group in the Abstract Syntax Tree (AST).
 */
export class ComparisonGroupAST extends AST {
  logicalOperator: LogicalOperator | null = null;
  comparisons: (ComparisonGroupAST | ComparisonAST)[] = [];


  /**
   * 
   * Constructs a new instance of the class.
   * 
   * @param matches 
   * @param logicalOperator
   * 
   * This constructor initializes the following properties:
   * - `logicalOperator`: The logical operator that connects this group to the next.
   * - `comparisons`: An array of comparisons or comparison groups.
   * - `tokens`: An array of tokens representing the comparison group.
   * - `lineNumber`: The line number of the first non-whitespace token.
   * - `startIndex`: The start index of the first token.
   * - `endIndex`: The end index of the last token.
   */
  constructor(matches: MatchedRule[], logicalOperator: LogicalOperator | null = null) {
    super();
    if (matches.length === 0) {
      return;
    }

    const pop = (array: MatchedRule[], scope: string): [MatchedRule[], (LogicalOperator | ComparisonOperator)] => {
      const match: MatchedRule | undefined = array.find((match) => match.rule?.type === scope);
      const result = match?.tokens
        .map((token) => token.scopes.includes(`meta.${scope}.sql`) ? token.value : '')
        .join('') as LogicalOperator;

      if (match !== undefined) {
        const index = array.indexOf(match);
        if (index !== -1) {
          array.splice(index, 1);
        }
      }

      return [array, result];
    };

    this.logicalOperator = logicalOperator;

    // split matches into comparisons
    const comparisonsParts: number[][] = [];
    let lastIndex: number = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      // check for comparison group or logical operator
      if (match.rule?.type === "group") {
        comparisonsParts.push([lastIndex, i + 1]);
        lastIndex = i + 1;
        continue;
      }

      if (match.rule?.type === "operator" && i > 0) {
        comparisonsParts.push([lastIndex, i]);
        lastIndex = i;
        continue;
      }
    }

    if (lastIndex < matches.length - 1) {
      comparisonsParts.push([lastIndex, matches.length]);
    }

    for (const part of comparisonsParts) {
      let partMatches = matches.slice(part[0], part[1]);
      const tokens = partMatches.map((match) => match.tokens).flat();
      let result: (LogicalOperator | ComparisonOperator | null);
      let operator: LogicalOperator | null = null;
      let comparison: ComparisonOperator | null = null;
      // is there a comparison group?
      if (partMatches.length === 1 && partMatches[0].rule?.type === "group") {
        if (!(partMatches[0].rule?.name === "comparison.group")) {
          operator = partMatches[0].tokens.map((token) => token.scopes.includes("meta.operator.sql") ? token.value : '').join('') as LogicalOperator;
        }
        this.tokens.push(...partMatches[0].tokens);
        const group = new ComparisonGroupAST(partMatches[0].matches ?? [], operator);
        this.comparisons.push(group);
        this.tokens.push(...group.tokens);
        continue;
      }

      if (partMatches.length > 1) {
        [partMatches, result] = pop(partMatches, "operator");

        if (result !== null) {
          operator = result as LogicalOperator;
        }
      }

      if (partMatches.length === 3) {
        [partMatches, result] = pop(partMatches, "comparison");

        if (result !== null) {
          comparison = result as ComparisonOperator;
        }
      }

      const comparisonObj: Comparison = { "logicalOperator": operator, "operator": comparison } as Comparison;

      for (const match of partMatches ?? []) {
        let parameter: Column | ArrayAST | null = null;
        if (match.rule?.type === 'column') {
          parameter = new ColumnAST(match);
        } else if (match.rule?.type === 'function') {
          parameter = new ColumnFunctionAST(match);
        } else if (match.rule?.type === 'string') {
          parameter = new StringAST(match.tokens);
        } else if (match.rule?.type === 'number') {
          parameter = new NumberAST(match.tokens);
        } else if (match.rule?.type === 'keyword') {
          parameter = new KeywordAST(match.tokens);
        } else if (match.rule?.type === 'group') {
          parameter = new ArrayAST(match.matches ?? []);
          tokens.push(...parameter.tokens);
        }

        if (comparisonObj.left === null) {
          comparisonObj.left = parameter;
        } else if (comparisonObj.right === null) {
          comparisonObj.right = parameter;
        }
      }

      const comp = new ComparisonAST(comparisonObj, tokens);
      this.comparisons.push(comp);
      this.tokens.push(...comp.tokens);
    }

    this.tokens = sortTokens(this.tokens);
  }
}



/**
 * Represents a comparison operation in the AST (Abstract Syntax Tree).
 * 
 * @typedef {Object} Comparison
 * 
 * @property {Column | ArrayAST | null} left - The left-hand side of the comparison, which can be a column, an array, or null.
 * @property {ComparisonOperator | null} operator - The operator used in the comparison, which can be a comparison operator or null.
 * @property {Column | ArrayAST | null} right - The right-hand side of the comparison, which can be a column, an array, or null.
 * @property {LogicalOperator | null} logicalOperator - The logical operator used to combine this comparison with others, which can be a logical operator or null.
 */
type Comparison = {
  left: Column | ArrayAST | null,
  operator: ComparisonOperator | null,
  right: Column | ArrayAST | null,
  logicalOperator: LogicalOperator | null
}
// endregion comparison

// region objects

/**
 * Represents an array in the Abstract Syntax Tree (AST).
 */
export class ArrayAST extends AST {
  values: (StringAST | NumberAST)[] = [];
  

  /**
   * Constructs a new instance of the ArrayAST class.
   * 
   * @param matchedRules - An array of matched rules containing the tokens to be parsed.
   * 
   * This constructor initializes the following properties:
   * - `lineNumber`: The line number of the first non-whitespace token.
   * - `startIndex`: The start index of the first token.
   * - `endIndex`: The end index of the last token.
   * - `tokens`: An array of tokens representing the array.
   * - `values`: An array of StringAST and NumberAST objects representing the values in the array.
   */
  constructor(matchedRules: MatchedRule[]) {
    super();
    this.lineNumber = matchedRules[0].tokens[0].lineNumber;
    this.startIndex = matchedRules[0].tokens[0].startIndex;
    this.endIndex = matchedRules[matchedRules.length - 1].tokens[matchedRules[matchedRules.length - 1].tokens.length - 1].endIndex;
    this.tokens = matchedRules.map((match) => match.tokens).flat();

    for (const match of matchedRules) {
      if (match.rule?.type === 'string') {
        this.values.push(new StringAST(match.tokens));
      } else if (match.rule?.type === 'number') {
        this.values.push(new NumberAST(match.tokens));
      }
    }
  }
}

/**
 * Represents a join in the Abstract Syntax Tree (AST).
 */
export class JoinAST extends AST {
  join: JoinType | null = JoinType.INNER;
  source: ObjectAST | StatementAST | null = null;
  on: ComparisonGroupAST | null = null;
  
  /**
   * Constructs a new instance of the class.
   * 
   * @param matchedRule - The matched rule containing the tokens to be parsed.
   * 
   * This constructor initializes the following properties:
   * - `join`: The type of join, which can be an inner, left, right, or full join.
   * - `source`: The source object of the join, which can be an ObjectAST or StatementAST.
   * - `on`: The comparison group representing the join condition.
   * - `lineNumber`: The line number of the first non-whitespace token.
   * - `startIndex`: The start index of the first token.
   * - `endIndex`: The end index of the last token.
   * - `tokens`: An array of tokens representing the join.
   */
  constructor(matchedRule: MatchedRule) {
    super();
    this.tokens.push(...matchedRule.tokens);
    this.lineNumber = matchedRule.tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
    this.startIndex = matchedRule.tokens[0].startIndex;

    this.join = findToken(matchedRule.tokens, "keyword.join.sql")?.value as JoinType;
    this.source = new ObjectAST(matchedRule.tokens);

    this.on = new ComparisonGroupAST(matchedRule.matches ?? []);
    this.tokens.push(...this.on.tokens);

    this.endIndex = this.tokens[this.tokens.length - 1].endIndex;
  }
}

/**
 * Represents an object in the Abstract Syntax Tree (AST).
 */
export class ObjectAST extends AST {
  project: string | null = null;
  dataset: string | null = null;
  object: string | null = null;
  
  /**
   * 
   * Constructs a new instance of the class.
   * 
   * @param tokens 
   * 
   * This constructor initializes the following properties:
   * - `project`: The project name extracted from the tokens.
   * - `dataset`: The dataset name extracted from the tokens.
   * - `object`: The object name extracted from the tokens.
   * - `alias`: The alias extracted from the tokens.
   * - `lineNumber`: The line number of the first non-whitespace token.
   * - `startIndex`: The start index of the first token.
   * - `endIndex`: The end index of the last token.
   * - `tokens`: An array of tokens representing the object.
   * 
   */
  constructor(tokens: LineToken[] | Token[]) {
    super();
    const project = findToken(tokens, "entity.name.project.sql");
    const dataset = findToken(tokens, "entity.name.dataset.sql");
    const object = findToken(tokens, "entity.name.object.sql");
    const alias = findToken(tokens, "entity.name.alias.sql");

    const statementTokens = [project, dataset, object, alias].filter((token) => token !== null);
    if (statementTokens.length === 0) {
      return;
    }

    this.project = project?.value ?? null;
    this.dataset = dataset?.value ?? null;
    this.object = object?.value ?? null;
    this.alias = alias?.value ?? null;
    this.lineNumber = Math.min(...statementTokens.map((token) => token?.lineNumber ?? 0));
    this.startIndex = Math.min(...statementTokens.map((token) => token?.startIndex ?? 0));
    this.endIndex = Math.min(...statementTokens.map((token) => token?.endIndex ?? 0));
    this.tokens = statementTokens.filter(token => token !== null) as Token[];
  }
}
// endregion objects
// region statement
/**
 * The abstract syntax tree for the SQL code
 */
export class StatementAST extends AST {
  with: StatementAST | null = null;
  type: StatementType | null = StatementType.SELECT;
  object: ObjectAST | null = null;
  options: null = null;
  distinct: boolean = false;
  columns: Column[] = [];
  from: ObjectAST | StatementAST | null = null;
  joins: JoinAST[] = [];
  where: ComparisonGroupAST | null = null;
  groupby: ColumnAST[] = [];
  having: string | null = null;
  orderby: ColumnAST[] = [];
  limit: number | null = null;
  statement: string | null = null;

  /**
   * Processes a matched rule and updates the internal state based on the rule type.
   *
   * @param matchedRule - The matched rule object containing the rule and tokens to process.
   * 
   * The function performs the following actions based on the rule type:
   * - 'dml': Extracts the statement type and object AST from the tokens and updates the type and object properties.
   * - 'select': Checks if the tokens contain a "keyword.select.distinct.sql" scope and sets the distinct property to true if found.
   * - 'from': Creates a new ObjectAST from the tokens and assigns it to the from property.
   * - 'join': Creates a new JoinAST from the matched rule and adds it to the joins array.
   * - 'where': Creates a new ComparisonGroupAST from the matched rule matches and assigns it to the where property.
   * - Default: Creates a new column from the matched rule and adds it to the columns array.
   */
  processRule(matchedRule: MatchedRule): void {
    const rule = matchedRule.rule;
    if (rule) {
      const tokens = matchedRule.tokens;
      if (rule.type === 'dml') {
        const [type, objectAST] = extractStatementType(tokens);
        if (type) {
          this.type = type;
        }
        this.object = objectAST;
      } else if (rule.type === 'select') {
        if (tokens.find((token) => token.scopes.includes("keyword.select.distinct.sql"))) {
          this.distinct = true;
        }
      } else if (rule.type === 'from') {
        this.from = new ObjectAST(tokens);
      } else if (rule.type === 'join') {
        this.joins.push(new JoinAST(matchedRule));
      } else if (rule.type === 'where') {
        this.where = new ComparisonGroupAST(matchedRule.matches ?? []);
      } else {
        this.columns.push(createColumn(matchedRule));
      }
    }
  }

}
// endregion statement