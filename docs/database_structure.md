# Database structure

Here is the architecture of my database:

## `contents` table

It is groups all data related to a question and a answer. But the information is not stored within this table. Actually, it is just a one single column with ids table to group all the data, that related with the content through foreign keys.

Follows the table structure:
```
 Column |  Type   | Collation | Nullable |               Default                | Storage | Compression | Stats target | Description 
--------+---------+-----------+----------+--------------------------------------+---------+-------------+--------------+-------------
 id     | integer |           | not null | nextval('contents_id_seq'::regclass) | plain   |             |              | 
Indexes:
    "contents_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "meta_names" CONSTRAINT "fk_meta_names_content" FOREIGN KEY (content_id) REFERENCES contents(id)
    TABLE "question_options" CONSTRAINT "fk_question_options_content" FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
Access method: heap
```

## `meta_names` table

This is where the data classification is stored. It *names* the several content data. Each content may have several *meta name* related to it, and the forerign key  linking to the content is within this table.
Now, follows the `meta_names` structure table.

```
   Column   |       Type        | Collation | Nullable |                Default                 | Storage  | Compression | Stats target | Description 
------------+-------------------+-----------+----------+----------------------------------------+----------+-------------+--------------+-------------
 id         | integer           |           | not null | nextval('meta_names_id_seq'::regclass) | plain    |             |              | 
 meta_name  | character varying |           | not null |                                        | extended |             |              | 
 content_id | integer           |           | not null |                                        | plain    |             |              | 
 parent_id  | integer           |           |          |                                        | plain    |             |              | 
Indexes:
    "meta_names_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "fk_meta_names_content" FOREIGN KEY (content_id) REFERENCES contents(id)
    "fk_meta_names_parent" FOREIGN KEY (parent_id) REFERENCES meta_names(id)
Referenced by:
    TABLE "long_text_meta_value" CONSTRAINT "fk_long_text_meta_name" FOREIGN KEY (meta_names_id) REFERENCES meta_names(id)
    TABLE "meta_names" CONSTRAINT "fk_meta_names_parent" FOREIGN KEY (parent_id) REFERENCES meta_names(id)
```

## `long_text_meta_value` table

This is the table that stores the information. Here is the table structure:
```
     Column       |  Type   | Collation | Nullable |                     Default                      | Storage  | Compression | Stats target | Description 
-------------------+---------+-----------+----------+--------------------------------------------------+----------+-------------+--------------+-------------
 id                | integer |           | not null | nextval('long_text_meta_value_id_seq'::regclass) | plain    |             |              | 
 string_meta_value | text    |           | not null |                                                  | extended |             |              | 
 meta_names_id     | integer |           | not null |                                                  | plain    |             |              | 
Indexes:
    "long_text_meta_value_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "fk_long_text_meta_name" FOREIGN KEY (meta_names_id) REFERENCES meta_names(id)
Access method: heap
```
The content of `long_text_meta_value` relates to one `meta_names` entry through `meta_names_id`.