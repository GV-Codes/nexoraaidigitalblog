---
title: SQL in 30 Minutes: The Five Queries You Actually Need
date: 2026-10-11
labels: Data Analytics, SQL
summary: Learn SELECT, WHERE, GROUP BY, JOIN and ORDER BY with one small example you can run today.
---

You do not need to master all of SQL to answer real business questions. Five building blocks cover most day-to-day analysis.

Imagine two tables. `orders` has `order_id`, `customer_id`, `order_date` and `amount`. `customers` has `customer_id`, `name` and `country`.

## 1. SELECT and FROM: look at your data

```sql
SELECT order_id, order_date, amount
FROM orders;
```

Pick the columns you want from the table you name.

## 2. WHERE: filter rows

```sql
SELECT order_id, amount
FROM orders
WHERE amount > 100;
```

Only orders above 100 come back. Combine conditions with `AND` and `OR`.

## 3. ORDER BY and LIMIT: sort and trim

```sql
SELECT order_id, amount
FROM orders
ORDER BY amount DESC
LIMIT 10;
```

Your ten biggest orders, largest first.

## 4. GROUP BY: summarize

```sql
SELECT customer_id, COUNT(*) AS orders, SUM(amount) AS total_spent
FROM orders
GROUP BY customer_id;
```

One row per customer, with how many orders they placed and how much they spent. `COUNT`, `SUM`, `AVG`, `MIN` and `MAX` are your main tools.

## 5. JOIN: combine tables

```sql
SELECT c.name, c.country, SUM(o.amount) AS total_spent
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.name, c.country
ORDER BY total_spent DESC;
```

Now the totals show customer names instead of ID numbers.

## Read it like a sentence

A query is easier when you read it in order: *from these tables, keep these rows, group them like this, show these columns, sort them this way.*

## Try it today

Download a free sample database or load a CSV into a free SQL tool, then ask one question you actually care about. Write the query, run it, and change one thing. Curiosity plus five building blocks goes a long way.
