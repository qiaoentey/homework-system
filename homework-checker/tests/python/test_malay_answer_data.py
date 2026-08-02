import unittest

from tests.python.answer_test_helpers import load_named_book, validate_named_book


EXPECTED = {
    "1-malay": {"Keyy5R_NayQ", "tWyrRQaLcPU"},
    "2-malay": {"3G25_5LBgVc", "t45VdtZbe7A"},
    "3-malay": {"h9tA-QQg5jA", "kwFZZuDQc8Q"},
}


class MalayAnswerDataTests(unittest.TestCase):
    def test_malay_books_cover_every_primary_source(self):
        for resource_id, source_ids in EXPECTED.items():
            book = load_named_book(resource_id)
            assert validate_named_book(book) == []
            assert source_ids == {
                review.source_video_id for review in book.source_reviews
            }
            assert any(entry.confidence == "verified" for entry in book.entries)
            assert any(entry.confidence == "review" for entry in book.entries)


if __name__ == "__main__":
    unittest.main()
