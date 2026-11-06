"""python -I -m unittest discover -s scripts/tests   (from the skill folder). Run after any change to text_rules.py."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import text_rules as T  # noqa: E402

CFG = {"acronyms": ["NASA", "UN", "SMART"], "proper_nouns": ["Paris Agreement", "World Bank", "Paris"]}


class Rules(unittest.TestCase):
    def f(self, text, kind="bullet"):
        return T.fix(text, kind, CFG)[0]

    def test_sentence_case_title(self):
        self.assertEqual(self.f("WHAT IS HEALTHY SOIL?", "title"), "What is healthy soil?")
        self.assertEqual(self.f("SOIL IMPACT ASSESSMENT (NASA)", "title"), "Soil impact assessment (NASA)")
        self.assertEqual(self.f("Introduction to Sustainable Gardening", "title"), "Introduction to sustainable gardening")

    def test_proper_nouns_and_acronyms_survive(self):
        self.assertEqual(self.f("THE PARIS AGREEMENT", "title"), "The Paris Agreement")
        self.assertEqual(self.f("Support from the UN and World Bank"), "Support from the UN and World Bank.")
        self.assertEqual(self.f("Funding from NGOs"), "Funding from NGOs.")

    def test_only_first_letter_capital(self):
        self.assertEqual(self.f("Pollution: Air, Water, Soil"), "Pollution: air, water, soil.")
        self.assertEqual(self.f("Command-and-Control: Direct regulation (e.g., Emission limits)"),
                         "Command-and-control: direct regulation (e.g., emission limits).")

    def test_topic_stays_in_capitals(self):
        self.assertEqual(self.f("What is healthy soil?", "topic"), "WHAT IS HEALTHY SOIL?")
        self.assertEqual(self.f("Case study \u2014 the Paris Agreement", "topic"), "CASE STUDY \u2014 THE PARIS AGREEMENT")
        self.assertEqual(self.f("Colour and organize.", "topic"), "COLOUR AND ORGANISE")
        self.assertEqual(self.f("SUMMARY", "topic"), "SUMMARY")

    def test_one_word_title(self):
        self.assertEqual(self.f("SUMMARY", "title"), "Summary")
        self.assertEqual(self.f("NASA", "title"), "NASA")

    def test_second_sentence_is_capitalised(self):
        self.assertEqual(self.f("it rains. rivers Flood. Then we wait."), "It rains. Rivers flood. Then we wait.")

    def test_full_stops(self):
        self.assertEqual(self.f("Requires systematic analysis and response"), "Requires systematic analysis and response.")
        self.assertEqual(self.f("Can be local (e.g., a contaminated site)"), "Can be local (e.g., a contaminated site).")
        self.assertEqual(self.f("Who is affected?"), "Who is affected?")
        self.assertEqual(self.f("A good action plan includes:", "header"), "A good action plan includes:")
        self.assertEqual(self.f("Thank you.", "title"), "Thank you")
        self.assertEqual(self.f("Done;"), "Done.")

    def test_british(self):
        self.assertEqual(self.f("We organize and prioritize the color center"), "We organise and prioritise the colour centre.")
        self.assertEqual(self.f("Analyze behavior and defense", "bullet"), "Analyse behaviour and defence.")
        self.assertEqual(self.f("A program of traveling and labeling"), "A program of travelling and labelling.")   # 'program' is left for a human
        self.assertEqual(self.f("Size and seize the prize"), "Size and seize the prize.")
        self.assertEqual(self.f("Organization"), "Organisation.")

    def test_idempotent(self):
        for k, t in [("title", "RISK ASSESSMENT"), ("bullet", "Risk = Hazard \u00d7 Exposure"), ("bullet", "Goals: Broad (e.g., \u201cRestore water\u201d)")]:
            once = self.f(t, k)
            self.assertEqual(self.f(once, k), once)

    def test_check_flags_dirty_text(self):
        self.assertTrue(T.check_text("Types Of Problems", "title", CFG))
        self.assertFalse(T.check_text("Types of problems", "title", CFG))

    def test_review_flags(self):
        self.assertTrue(T.review_notes("A program for the people"))
        self.assertTrue(T.review_notes("\u201cquoted\u201d words"))


if __name__ == "__main__":
    unittest.main()
