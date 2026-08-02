# STP Yuan Ning Roster Design

## Goal

Add a fourth STP teacher option labeled `YUAN NING` and make the supplied 43 students the complete active roster for that group.

## Chosen approach

Use a database migration and matching source-roster update rather than copying students through the enrolment UI. Existing PS students are moved by their stable `source_ref`, so their UUID, profile, attendance, messages, lifecycle state, and activity history remain attached to the same student. Five names that are absent from every approved roster are inserted as new active students.

The new group contract is:

- Branch: `STP`
- Group code: `YUAN NING STP`
- Visible label: `YUAN NING`

## Existing-student matching

Thirty-two supplied names match PS case-insensitively. Six more are treated as corrected spellings of the following PS records:

| Existing PS name | Yuan Ning name | Grade |
| --- | --- | --- |
| EASON | Eason Chan | Y1 |
| 邓如予 | 邓茹予 | Y1 |
| 陈佳ying | 陈佳莹 | Y5 |
| 陈羽婕 | 陈羽捷 | K1+K2 |
| 李媛菲 | 李媛霏 | K1+K2 |
| 林佑骏 | 林佑峻 | Y1 |

All 38 matches move from `PS STP` to `YUAN NING STP`. PS falls from 121 to 83 active students.

## New students

The five names absent from every approved roster are added with grades inferred from their placement among the supplied roster sections:

| Name | Grade |
| --- | --- |
| Macy | Y1 |
| 杨景立 | Y1 |
| Julian | Y1 |
| Owen | Y5 |
| 陈梓煒 | K1+K2 |

## Final roster contract

`YUAN NING STP` contains exactly 43 active students:

- Y1 (29): 邓威乐、刘柏亨、曾于哲、张皓翔、黄靖芯、叶思羽、Macy、陈祈文、陈凯泽、Eason Chan、邓茹予、杨景立、Julian、和凯乐、Jayden、刘思源、刘恩甯、Afzan、Ava、陈美芯、陈嘉谦、范旻宏、蔡颜馡、伍悦帧、马佳瑜、陈凯、林宥承、林佑峻、刘俊盛
- Y5 (4): 陈杰、陈彦州、Owen、陈佳莹
- K1+K2 (10): 萧欣甯、萧皓恒、陈羽捷、丁文淇、卢奕衡、陈梓煒、李媛霏、Abby Lee、蔡卓亨、叶泋妤

The approved system-wide active roster total becomes 555: the original 550 students, minus no deletions, plus five new students.

## UI and API behavior

The branch-first screen still shows only MK, STP, and WS. Selecting STP displays four teacher options in this order: `巧恩`, `PS`, `SY`, `YUAN NING`. Selecting `YUAN NING` loads only its 43 active students. Every existing read/write scope check accepts the new STP group and continues rejecting cross-branch groups.

## Migration safety

The D1 and local PostgreSQL migrations create the teacher group before changing students. Existing PS records are selected by exact `source_ref`, not display name, to avoid moving the WS student also named Ava or any similarly named child. New records use stable source references and deterministic UUIDs for the hosted D1 seed path.

## Verification

Automated tests must prove:

- the catalog exposes `YUAN NING` only under STP;
- the new group has exactly 43 active students with the supplied display names and grades;
- PS has exactly 83 active students and none of the 38 transferred source references;
- transferred students retain the same UUIDs across the migration;
- all migrations remain repeat-safe and below the D1 statement-size limit;
- existing enrol, stop, restore, profile, attendance, and message tests remain green;
- the deployment build packages the new migration.
