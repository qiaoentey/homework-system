import unittest

from tests.python.answer_test_helpers import load_named_book, validate_named_book


EXPECTED = {
    "1-science": {"RPnSzMHUVBM"},
    "2-science": {"Gsn7Y9eR2mg"},
    "3-science": {"nP0HGVFNQ3M"},
}


class ScienceAnswerDataTests(unittest.TestCase):
    def test_science_books_cover_every_primary_source(self):
        for resource_id, source_ids in EXPECTED.items():
            book = load_named_book(resource_id)
            assert validate_named_book(book) == []
            assert {review.source_video_id for review in book.source_reviews} == source_ids
            assert any(entry.confidence == "verified" for entry in book.entries)


if __name__ == "__main__":
    unittest.main()
