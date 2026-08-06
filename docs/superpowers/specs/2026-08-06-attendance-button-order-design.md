# Attendance Button Order Design

## Goal

Make daily roll call faster by placing `缺席` directly beside `到` on every student card.

## Behavior

- The point-marking buttons begin with `到`, then `缺席`.
- The remaining buttons keep their existing relative order: `冲、餐、功、补、复、回、KOKO`.
- Event codes, saved attendance records, mutual exclusion between `到` and `缺席`, summaries, and all other behavior remain unchanged.
- The same order is used on desktop and mobile because both layouts render the shared event list.

## Validation

- A DOM test locks the complete visible button order on a student card.
- Existing client and Sites tests verify attendance behavior remains unchanged.
- Desktop and mobile browser checks verify the shared responsive interface.
