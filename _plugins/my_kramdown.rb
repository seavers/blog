module Jekyll
  module Converters
    class Markdown
      class MyKramdown < KramdownParser

        def convert(content)
          Kramdown::Document.new(content, Utils.symbolize_hash_keys(@config)).to_html
        end

      end
    end
  end
end
