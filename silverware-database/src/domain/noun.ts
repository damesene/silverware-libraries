// What the place a database is kept in calls its documents, for what is said
// to the user (an item is a document of its own: "its page" in SilverBullet):
// the platform's word, else "document". Never a key nor anything kept.

/** A word for a document, one and several */
export type Noun = { readonly one: string; readonly many: string };

/** The word where the platform has none of its own */
export const DOCUMENT: Noun = { one: "document", many: "documents" };

/** A noun with its first letter in capitals, as a label starts */
export const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
