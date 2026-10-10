import { describe, expect, test } from "bun:test";
import { createPointerTracker, type PlayerId } from "./input";

const setup = function () {
	const presses: PlayerId[] = [];
	const tracker = createPointerTracker(function (player) {
		presses.push(player);
	});
	return { presses, tracker };
};

describe("player pointer input", function () {
	test("all four players can press independently at the same time", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 1);
		tracker.pointerDown(20, 2);
		tracker.pointerDown(30, 3);
		tracker.pointerDown(40, 4);
		expect(presses).toEqual([1, 2, 3, 4]);
	});

	test("a pointer stays assigned to its initial corner until release", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 1);
		tracker.pointerDown(10, 2);
		tracker.pointerDown(20, 2);
		expect(presses).toEqual([1, 2]);
		tracker.pointerUp(10);
		tracker.pointerDown(10, 3);
		expect(presses).toEqual([1, 2, 3]);
	});

	test("extra fingers suppress presses until every finger on that control releases", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 1);
		tracker.pointerDown(11, 1);
		tracker.pointerUp(10);
		tracker.pointerDown(12, 1);
		tracker.pointerUp(11);
		expect(presses).toEqual([1]);
		tracker.pointerUp(12);
		tracker.pointerDown(13, 1);
		expect(presses).toEqual([1, 1]);
	});

	test("screen and round invalidation preserves physical holds without replaying them", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 1);
		tracker.pointerDown(11, 1);
		tracker.invalidate();
		tracker.invalidate();
		tracker.pointerDown(12, 1);
		tracker.pointerDown(20, 2);
		tracker.pointerUp(10);
		tracker.pointerUp(11);
		tracker.pointerDown(13, 1);
		expect(presses).toEqual([1, 2]);
		tracker.pointerUp(12);
		tracker.pointerUp(13);
		tracker.pointerDown(14, 1);
		expect(presses).toEqual([1, 2, 1]);
	});

	test("release or cancellation outside the control permits a fresh press", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 4);
		tracker.pointerUp(10);
		tracker.pointerUp(10);
		tracker.pointerUp(999);
		tracker.pointerDown(11, 4);
		expect(presses).toEqual([4, 4]);
	});

	test("disposal prevents callbacks from later input", function () {
		const { presses, tracker } = setup();
		tracker.pointerDown(10, 3);
		tracker.dispose();
		tracker.dispose();
		tracker.invalidate();
		tracker.pointerUp(10);
		tracker.pointerDown(11, 3);
		expect(presses).toEqual([3]);
	});
});
