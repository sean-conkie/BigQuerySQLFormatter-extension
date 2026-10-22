=====
Rules
=====

These rules aim to improve the readability and maintainability of code by ensuring that aliases are used correctly and consistently throughout the project.

.. _aliasing-rules:

----------------
Aliasing Rules
----------------

Aliasing rules are guidelines that help developers avoid common pitfalls when using aliases in SQL queries. They typically focus on the use of aliases for tables, columns, and expressions, helping developers avoid ambiguity and confusion in their queries.

.. toctree::
	:maxdepth: 1

	Rule: Always Use Implicit Aliases When Referencing Tables <aliasing/AL01>
	Rule: Do Not Use Explicit Aliasing (`AS`) When Aliasing Columns <aliasing/AL02>
	Rule: All Columns Should Have a Table Alias <aliasing/AL05>
	Rule: Tables Must Use an Alias <aliasing/AL06>
	Rule: Column Names in the Query Should Be Unique <aliasing/AL08>
	Rule: Avoid Self-Aliasing Columns <aliasing/AL09>

.. _ambiguous-rules:

----------------
Ambiguous Rules
----------------

Ambiguous rules are guidelines that help developers avoid ambiguity and improve the clarity of their SQL queries. They typically focus on naming conventions, column references, and query structure, helping developers create more readable and maintainable code.

.. toctree::
	:maxdepth: 1

	Rule: Do Not Use `DISTINCT` with `GROUP BY` <ambiguous/AM01>
	Rule: Avoid Using `select *` <ambiguous/AM04>

.. _capitalisation-rules:

--------------------
Capitalisation Rules
--------------------

Capitalisation rules are guidelines that help developers maintain consistent casing in their SQL queries. They typically focus on the capitalisation of keywords, identifiers, and literals, helping developers create more readable and uniform code.

.. toctree::
	:maxdepth: 1

	Rule: Use Lowercase for Literal `null`/`true`/`false` Values <capitalisation/CP04>

.. _convention-rules:

----------------
Convention Rules
----------------

Convention rules are guidelines that enforce consistent practices and coding patterns across a project. They typically focus on the structure, style, and efficiency of code, helping developers avoid anti-patterns and ensure that the project follows uniform conventions.

By applying convention rules, teams can create a more collaborative and coherent development environment where code is predictable, easier to review, and less error-prone.

.. toctree::
	:maxdepth: 1

	Rule: Use `!=` Not `<>` <convention/CV01>
	Rule: Use COALESCE Instead of IFNULL or NVL <convention/CV02>
	Rule: Select Statements Should Not Include a Trailing Comma <convention/CV03>
	Rule: Use `count(1)` to Express “Count Number of Rows” <convention/CV04>
	Rule: Comparisons with `NULL` Should Use `IS` or `IS NOT` <convention/CV05>
	Rule: Use LEFT join Instead of RIGHT join <convention/CV08>
	Rule: `UNION` and `EXCEPT` Must Be Followed by `ALL` or `DISTINCT` <convention/CV12>
	Rule: Use Spaces for Indentation, Not Tabs <convention/CV13>

.. _layout-rules:

------------
Layout Rules
------------

Layout rules are guidelines that help developers maintain a consistent and readable structure in their SQL queries. They typically focus on indentation, spacing, and alignment, helping developers create code that is easier to understand and maintain.

.. toctree::
	:maxdepth: 1

	Rule: Delete Trailing Whitespace <layout/LT01>
	Rule: Columns Should Be Indented Consistently <layout/LT02>
	Rule: Place Commas at the End of the Line <layout/LT04>
	Rule: Function Names Must Be Immediately Followed by Parentheses <layout/LT06>
	Rule: Select Targets Should Be on Separate Lines <layout/LT09>
	Rule: select Modifiers Must Be on the Same Line as select <layout/LT10>
	Rule: UNION Operators Should Be Surrounded by Newlines <layout/LT11>
	Rule: SQL Files Must End with a Single Trailing Newline <layout/LT12>
	Rule: SQL Files Must Not Begin with Newlines or Whitespace <layout/LT13>
	Rule: Align Equal (`=`) Sign in Comparison Blocks <layout/LT15>

.. _structure-rules:

---------------
Structure Rules
---------------

Structure rules are guidelines that help developers maintain a consistent and logical structure in their SQL queries. They typically focus on the organization of code, the use of control flow statements, and the handling of exceptions, helping developers create code that is easier to follow and debug.

.. toctree::
	:maxdepth: 1

	Rule: Do Not Specify Redundant `ELSE NULL` in a `CASE WHEN` Statement <structure/ST01>
	Rule: Specify Join Keys Instead of Using `USING` <structure/ST07>
	Rule: Do Not Use `DISTINCT` with Parentheses <structure/ST08>
	