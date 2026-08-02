import unittest

from tests.python.answer_test_helpers import load_named_book, validate_named_book


EXPECTED = {
    "1-chinese": {"681yp19nZBM", "OJug4NJxqJw"},
    "2-chinese": {"AeoMa2D2bzE", "QqxSfx8mNTs"},
    "3-chinese": {"cqZdp5Zluws", "XYS23HEUw_o"},
}


class ChineseAnswerDataTests(unittest.TestCase):
    def test_chinese_books_cover_every_primary_source(self):
        for resource_id, source_ids in EXPECTED.items():
            book = load_named_book(resource_id)
            assert validate_named_book(book) == []
            assert source_ids.issubset(
                {review.source_video_id for review in book.source_reviews}
            )
            assert any(entry.confidence == "verified" for entry in book.entries)
            assert any(entry.confidence == "review" for entry in book.entries)


if __name__ == "__main__":
    unittest.main()
