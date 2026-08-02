import unittest

from tests.python.answer_test_helpers import load_named_book, validate_named_book


EXPECTED = {
    "1-mathematics": {"DgRklqnMEHI", "-ukU8RoBV-Q"},
    "2-mathematics": {"_6-CMY0lIhI"},
    "3-mathematics": {"CKrCzJwoPK8"},
}


class MathematicsAnswerDataTests(unittest.TestCase):
    def test_math_books_cover_every_primary_source(self):
        for resource_id, source_ids in EXPECTED.items():
            book = load_named_book(resource_id)
            assert validate_named_book(book) == []
            assert {review.source_video_id for review in book.source_reviews} == source_ids
            assert any(entry.confidence == "verified" for entry in book.entries)


if __name__ == "__main__":
    unittest.main()
