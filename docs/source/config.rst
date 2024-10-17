=============
Configuration
=============

Fix on save
~~~~~~~~~~~

Add the following to your ``settings.json``.

.. code-block:: json

    "[googlesql]": {
      "editor.codeActionsOnSave": {
        "source.fixAll": "explicit"
      }
    },


Disable Rules
~~~~~~~~~~~~~

In-line directive
-----------------

To disable all rules for a line add comment ``-- noqa``.

.. code-block:: sql

    select case when cc.enddate is null then 1 else null end as is_current -- noqa
      from dataset.table cc;
    

To disable specific rules for a line add comment ``-- noqa`` followed by a comma separated list of rules.

.. code-block:: sql

    select case when cc.enddate is null then 1 else null end as is_current -- noqa: ST01
      from dataset.table cc;
    
