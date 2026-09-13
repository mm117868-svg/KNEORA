import array
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("generator", Path(__file__).resolve().parents[1] / "tools" / "generate-countdown.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class CountdownTests(unittest.TestCase):
    def test_numbers_occupy_separate_one_second_slots(self):
        result = generator.assemble([array.array("h", [i]) * 5000 for i in range(5, 0, -1)])
        self.assertEqual(len(result), generator.RATE * 5)
        for index, number in enumerate(range(5, 0, -1)):
            slot = result[index * generator.RATE:(index + 1) * generator.RATE]
            self.assertEqual(sum(value == number for value in slot), 5000)
            self.assertEqual(sum(value == 0 for value in slot), generator.RATE - 5000)

    def test_invalid_clips_cannot_overrun_or_produce_silent_countdown(self):
        for clips in ([array.array("h", [1])] * 4,
                      [array.array("h", [0]) * 4000] * 5,
                      [array.array("h", [1]) * generator.RATE] * 5):
            with self.assertRaises(RuntimeError):
                generator.assemble(clips)


if __name__ == "__main__":
    unittest.main()
