# ADR-222: email addresses are checked with a stated pattern

**Status:** Accepted.

`EmailStr` refuses reserved domains such as `.test`, but the JSON Schema it publishes only says `format: email`. Schemathesis, correctly, generated valid-looking addresses the API then rejected, so the document promised something the server did not accept. The fix is to make both sides say the same thing: one pattern (`^[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+$`, at most 254 characters) is used by the validator and published in the schema, and the address is lower-cased (BR-201).

This is a shape check, not proof the address exists or follows every RFC 5321 rule. It is the same class of check most login forms make; deliverability is out of scope.
