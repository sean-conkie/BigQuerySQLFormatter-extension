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

	Rule: Avoid Self-Aliasing Columns <aliasing/AL09>

.. _ambiguous-rules:

----------------
Ambiguous Rules
----------------

Ambiguous rules are guidelines that help developers avoid ambiguity and improve the clarity of their SQL queries. They typically focus on naming conventions, column references, and query structure, helping developers create more readable and maintainable code.

.. toctree::
	:maxdepth: 1

	Rule: Avoid Using `SELECT *` <ambiguous/AM04>

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

	Rule: Use LEFT JOIN Instead of RIGHT JOIN <convention/CV08>

.. _layout-rules:

----------------
Layout Rules
----------------

Layout rules are guidelines that help developers maintain a consistent and readable structure in their SQL queries. They typically focus on indentation, spacing, and alignment, helping developers create code that is easier to understand and maintain.

.. toctree::
	:maxdepth: 1

	Rule: Delete Trailing Whitespace <layout/LT01>
	Rule: Place Commas at the End of the Line <layout/LT04>
	Rule: Function Names Must Be Immediately Followed by Parentheses <layout/LT06>
	Rule: Select Targets Should Be on Separate Lines <layout/LT09>
	Rule: SELECT Modifiers Must Be on the Same Line as SELECT <layout/LT10>
	Rule: UNION Operators Should Be Surrounded by Newlines <layout/LT11>
	Rule: SQL Files Must End with a Single Trailing Newline <layout/LT12>
	Rule: SQL Files Must Not Begin with Newlines or Whitespace <layout/LT13>
	Rule: Align Equal (`=`) Sign in Comparison Blocks <layout/LT15>