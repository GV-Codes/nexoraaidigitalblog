---
title: Business Analysis Starter Kit: Writing Clear Requirements
date: 2026-10-10
labels: Business Analysis, Requirements
summary: How to turn vague requests into clear, testable requirements using user stories and acceptance criteria.
---

Projects rarely fail because people cannot build things. They fail because people build the wrong thing. Clear requirements are the cheapest insurance against that.

## Start with the problem

Before writing any requirement, answer three questions:

1. Who has the problem?
2. What are they trying to do?
3. Why does it matter to the business?

"We need a dashboard" is a solution. "Sales managers spend two hours every Monday collecting numbers for the weekly review" is a problem. Solve the second one.

## The user story format

A simple sentence keeps everyone focused on value:

> As a **sales manager**, I want **a weekly summary of team results**, so that **I can prepare for Monday's review in minutes**.

## Add acceptance criteria

Acceptance criteria say how you will know the story is done. Make each one testable.

- The summary shows revenue, deals closed and pipeline by team member.
- Data refreshes automatically every Monday at 7:00.
- The summary can be exported to PDF.
- A manager can open it on a phone.

If two reasonable people could disagree about whether a criterion is met, it is not clear yet.

## Words to watch for

| Vague word | Ask instead |
| --- | --- |
| Fast | How many seconds? |
| User-friendly | Which task, done by whom, in how many clicks? |
| Secure | Which standard or risk are we protecting against? |
| Regularly | Daily, weekly, on which day and time? |

## Check with the people involved

Read the requirements back to the person who asked, and to the person who will build them. Mismatched expectations are far cheaper to fix on paper than in code.

## Try it today

Take one request sitting in your inbox. Rewrite it as a user story with three testable acceptance criteria, and send it back with the question: "Did I get this right?"
