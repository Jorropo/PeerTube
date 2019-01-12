/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoCommentModel } from '../../models/video/video-comment'

const expect = chai.expect

class CommentMock {
  text: string

  extractMentions = VideoCommentModel.prototype.extractMentions
}

describe('Comment model', function () {
  it('Should correctly extract mentions', async function () {
    const comment = new CommentMock()

    comment.text = '@florian @jean@localhost:9000 @flo @another@localhost:9000 @flo2@jean.com hello ' +
      'email@localhost:9000 coucou.com no? @chocobozzz @chocobozzz @end'
    const result = comment.extractMentions().sort()

    expect(result).to.deep.equal([ 'another', 'chocobozzz', 'end', 'flo', 'florian', 'jean' ])
  })
})