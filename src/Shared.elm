module Shared exposing (..)

import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode


type alias Todo =
    { id : Int, name : String }


todoDecoder : Decoder Todo
todoDecoder =
    Decode.map2
        Todo
        (Decode.field "id" Decode.int)
        (Decode.field "name" Decode.string)


todoEncoder : Todo -> Encode.Value
todoEncoder todo =
    Encode.object
        [ ( "id", Encode.int todo.id )
        , ( "name", Encode.string todo.name )
        ]
