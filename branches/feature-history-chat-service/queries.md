SELECT
    mn.content_id
    ,mn.meta_name
    ,ltmv.string_meta_value
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
WHERE mn.content_id = 1752
ORDER BY ltmv.id DESC;


SELECT
    mn.content_id
    ,mn.meta_name
    ,SUBSTR(
        ltmv.string_meta_value,
        1,
        200
    )
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
WHERE mn.content_id IN (1756, 1755)
ORDER BY ltmv.id DESC;



SELECT
    mn.content_id
    ,mn.meta_name
    ,SUBSTR(
        ltmv.string_meta_value,
        1,
        200
    )
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
ORDER BY ltmv.id DESC
LIMIT 100;



SELECT
    ltmv.id,
    ltmv.string_meta_value
FROM
    long_text_meta_value ltmv
ORDER BY id DESC
LIMIT 100;



SELECT
    ltmv.id,
    mn.content_id,
    mn.meta_name,
    ltmv.string_meta_value
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
WHERE mn.meta_name = 'chatId'
ORDER BY ltmv.id DESC
LIMIT 10;


SELECT
    mn.meta_name,
    ltmv.string_meta_value
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
WHERE mn.meta_name = 'chatId'
ORDER BY ltmv.id DESC
LIMIT 10;



SELECT DISTINCT
    ltmv.id,
    mn.meta_name,
    ltmv.string_meta_value
FROM
    long_text_meta_value ltmv
LEFT JOIN
    meta_names mn ON mn.id = ltmv.meta_names_id
WHERE mn.meta_name = 'chatId'
ORDER BY ltmv.id DESC
LIMIT 10;



SELECT
    string_meta_value
FROM
    long_text_meta_value
WHERE
    string_meta_value = ""




1. Listar de forma unique os chatIds (query) com paginação
2. Para cada chat Id, buscar os contents ids (query x (1.)). Cada chat Id pode ter mais de um content id.
3. Agrupar os chats ids com seus respectivos content ids.

