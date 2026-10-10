export type PlayerId = 1 | 2 | 3 | 4;

export interface PlayerControl {
	element: HTMLElement;
	player: PlayerId;
}

/** Tracks physical holds independently of round or screen transitions. */
export const createPointerTracker = function (onPress: (player: PlayerId) => void) {
	const heldPointers = new Map<number, PlayerId>();
	let disposed = false;

	return {
		pointerDown: function (pointerId: number, player: PlayerId): void {
			if (disposed || heldPointers.has(pointerId)) return;
			const alreadyHeld = Array.from(heldPointers.values()).includes(player);
			heldPointers.set(pointerId, player);
			if (!alreadyHeld) onPress(player);
		},
		pointerUp: function (pointerId: number): void {
			heldPointers.delete(pointerId);
		},
		invalidate: function (): void {
			// Keep every physical hold, including extra fingers, until its release.
			// No press is buffered or replayed into the next game state.
		},
		dispose: function (): void {
			disposed = true;
			heldPointers.clear();
		},
	};
};

/** Reports one press on initial down; movement never changes corner ownership. */
export const attachPlayerInput = function (
	controls: readonly PlayerControl[],
	onPress: (player: PlayerId) => void,
): { invalidate: () => void; dispose: () => void } {
	const tracker = createPointerTracker(onPress);
	const captures = new Map<number, HTMLElement>();
	const documents = new Set(controls.map(function (control) {
		return control.element.ownerDocument;
	}));
	const release = function (event: PointerEvent): void {
		captures.delete(event.pointerId);
		tracker.pointerUp(event.pointerId);
	};
	const blockGesture = function (event: Event): void {
		event.preventDefault();
	};
	const cleanups = controls.map(function ({ element, player }) {
		const previousTouchAction = element.style.touchAction;
		element.style.touchAction = "none";
		const down = function (event: PointerEvent): void {
			event.preventDefault();
			if (event.pointerType === "mouse" && event.button !== 0) return;
			try {
				element.setPointerCapture(event.pointerId);
				captures.set(event.pointerId, element);
			} catch {
				// A released pointer can lose eligibility for capture synchronously.
				// Document listeners still observe its release outside the control.
			}
			// Register capture first so disposal from onPress releases it too.
			tracker.pointerDown(event.pointerId, player);
		};
		element.addEventListener("pointerdown", down);
		element.addEventListener("lostpointercapture", release);
		element.addEventListener("contextmenu", blockGesture);
		element.addEventListener("dragstart", blockGesture);
		return function (): void {
			element.removeEventListener("pointerdown", down);
			element.removeEventListener("lostpointercapture", release);
			element.removeEventListener("contextmenu", blockGesture);
			element.removeEventListener("dragstart", blockGesture);
			element.style.touchAction = previousTouchAction;
		};
	});
	for (const document of documents) {
		document.addEventListener("pointerup", release, true);
		document.addEventListener("pointercancel", release, true);
	}
	let disposed = false;
	return {
		invalidate: tracker.invalidate,
		dispose: function (): void {
			if (disposed) return;
			disposed = true;
			tracker.dispose();
			for (const cleanup of cleanups) cleanup();
			for (const document of documents) {
				document.removeEventListener("pointerup", release, true);
				document.removeEventListener("pointercancel", release, true);
			}
			for (const [pointerId, element] of captures) {
				if (element.hasPointerCapture(pointerId)) {
					element.releasePointerCapture(pointerId);
				}
			}
			captures.clear();
		},
	};
};
