# Transcription Summary v3 Preview test pack

Набор содержит двенадцать synthetic обезличенных сценариев для ручной
Preview-проверки: исходные десять Phase 9 и два regression-кейса по ручному
аудиту. Regression-кейсы сохраняют бизнес-смысл отчётов, но не содержат
персональных данных исходных звонков.
Он не используется как основание для искусственного выставления score 95+.

Для каждого сценария проверяются:

- роли и отсутствие выдуманных фактов;
- типизированные Facts, Needs и Outcome;
- complete Store v3 без legacy fields;
- честный Summary и корректный next step;
- пять независимых Judge score в ожидаемых диапазонах;
- объяснимое решение Quality Gate;
- только `DRY_RUN` или policy-driven `SKIPPED` для CRM;
- отсутствие schema/parse/Structured Output technical errors в обычных сценариях.

Транскрипции не содержат телефонов, email, имён, адресов или CRM credentials.
