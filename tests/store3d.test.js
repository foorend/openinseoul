import test from "node:test";
import assert from "node:assert/strict";
import { FORMATS } from "../src/data.js";
import { seatPlan, storeLayout } from "../src/store3d.js";

test("3D store preview seats match each format and props stay inside the shop", () => {
  for (const format of FORMATS) {
    const layout = storeLayout(format);
    const seats = layout.props.reduce((sum, prop) => sum + (prop.seats ?? 0), 0);
    assert.equal(seats, format.seats, `${format.id} 좌석 수`);
    for (const prop of layout.props.filter((item) => item.name !== "sign")) {
      assert.ok(Math.abs(prop.x) <= layout.width / 2 && Math.abs(prop.z) <= layout.depth / 2, `${format.id} ${prop.name} 매장 안`);
    }
    assert.equal(layout.props.some((prop) => prop.name === "deck_oven"), !!format.bakes, `${format.id} 오븐은 베이커리만`);
  }
  assert.deepEqual(seatPlan(8, true), { two: 2, stools: 4 });
  assert.deepEqual(seatPlan(18, false), { two: 6, stools: 6 });
});
