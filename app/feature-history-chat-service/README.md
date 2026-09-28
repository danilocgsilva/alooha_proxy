## Missing ChatId

To get the chat history, relying on a query is the most efficient way.



The idea is to list chats, not contents. But the data architecture is designed to deal with the content. The biggest issue is there are some contents that do not have a chatId linked to it, while the query shall be centric into the chatId.




To make the query work nice, I must have that all content have a `chatId` linked to it. Then, I just need to add a new chatId to each of the contents that is missing.

To do it, first I need a query to list all content ids that have no chatId linked. Here is the query:

```sql
SELECT
	c2.id as "Content 2 ID"
FROM contents c2
WHERE c2.id NOT IN (
	SELECT
		c.id
	FROM contents c
	LEFT JOIN meta_names mn ON mn.content_id = c.id
	WHERE mn.meta_name = 'chatId'
);
```

Then, have a tiny application to fullfill a chatid to those ids.
