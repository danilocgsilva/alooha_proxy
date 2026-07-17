SELECT
    COUNT(*) as count,
    ltmv.string_meta_value
FROM contents c
LEFT JOIN meta_names nm ON nm.content_id = c.id
LEFT JOIN long_text_meta_value ltmv ON ltmv.meta_names_id = nm.id
WHERE nm.meta_name = 'model'
GROUP BY ltmv.string_meta_value
ORDER BY count DESC
;