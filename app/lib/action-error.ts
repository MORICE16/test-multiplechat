/** Only a proven pre-dispatch failure or explicit rejection permits retry. */
export class ActionError extends Error {
  retrySafe: boolean;
  constructor(message: string, retrySafe = false) {
    super(message);
    this.name = "ActionError";
    this.retrySafe = retrySafe;
  }
}

export function actionFailure(error: unknown) {
  const retrySafe = error instanceof ActionError && error.retrySafe;
  return {
    status: retrySafe ? "pending" : "needs_review",
    message: retrySafe ? error.message : "Résultat externe à vérifier. La réponse a été perdue ou n’a pas pu être confirmée. Morice bloque toute nouvelle exécution pour éviter un doublon.",
  };
}
